package voice

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"sync"
)

// StubClassifier is a deterministic fake Classifier for end-to-end testing. It
// lets the whole pipeline (audio -> features -> classifier -> command mapper ->
// editor action) run before a trained model exists. It is NOT a recogniser: its
// output says nothing about what was spoken.
//
// Two behaviours, both fully deterministic:
//
//   - Hash mode (default): the prediction is a pure function of the feature
//     vector, spread over the whole label set.
//   - Script mode (WithScript): the given labels are returned in order, cycling,
//     with a fixed confidence. Use it to fire one specific editor action.
//
// The algorithm uses integer arithmetic only and is the same as
// backend-python/services/stub_classifier.py; both test suites pin identical
// golden vectors so the two stubs agree bit-for-bit.
type StubClassifier struct {
	labels             []string
	labelIndex         map[string]int
	featureDim         int
	topK               int
	script             []string
	scriptedConfidence float64

	mu        sync.Mutex
	scriptPos int
}

const (
	stubInferenceMs        = 0.5
	stubMaxTopK            = 10
	stubDefaultScriptConf  = 0.90
	stubHashConfidenceMin  = 5000 // hash-mode confidence is 0.5000 .. 0.9900
	stubHashConfidenceSpan = 4900
	stubScale              = 10000
)

var _ Classifier = (*StubClassifier)(nil)

// StubOption customises a StubClassifier.
type StubOption func(*StubClassifier)

// WithLabels overrides the class labels (default: Labels()).
func WithLabels(labels []string) StubOption {
	return func(s *StubClassifier) { s.labels = append([]string(nil), labels...) }
}

// WithFeatureDim overrides the expected feature length (default: FeatureDim).
func WithFeatureDim(dim int) StubOption {
	return func(s *StubClassifier) { s.featureDim = dim }
}

// WithTopK sets how many ranked candidates are returned (default: TopK).
func WithTopK(k int) StubOption {
	return func(s *StubClassifier) { s.topK = k }
}

// WithScript switches to script mode: labels are returned in order, cycling.
func WithScript(script ...string) StubOption {
	return func(s *StubClassifier) { s.script = append([]string{}, script...) }
}

// WithScriptedConfidence sets the confidence used in script mode (default 0.90).
func WithScriptedConfidence(confidence float64) StubOption {
	return func(s *StubClassifier) { s.scriptedConfidence = confidence }
}

// NewStubClassifier builds a stub. It returns an error for inconsistent options
// rather than panicking later.
func NewStubClassifier(opts ...StubOption) (*StubClassifier, error) {
	s := &StubClassifier{
		labels:             Labels(),
		featureDim:         FeatureDim,
		topK:               TopK,
		scriptedConfidence: stubDefaultScriptConf,
	}
	for _, opt := range opts {
		opt(s)
	}

	if len(s.labels) == 0 {
		return nil, errors.New("labels must not be empty")
	}
	s.labelIndex = make(map[string]int, len(s.labels))
	for i, label := range s.labels {
		if _, dup := s.labelIndex[label]; dup {
			return nil, errors.New("labels must be unique")
		}
		s.labelIndex[label] = i
	}
	if s.featureDim < 1 {
		return nil, errors.New("feature dim must be positive")
	}
	if maxK := min(stubMaxTopK, len(s.labels)); s.topK < 1 || s.topK > maxK {
		return nil, fmt.Errorf("top_k must be within [1, %d]", maxK)
	}
	if s.script != nil {
		if len(s.script) == 0 {
			return nil, errors.New("script must not be empty")
		}
		for _, label := range s.script {
			if _, ok := s.labelIndex[label]; !ok {
				return nil, fmt.Errorf("script label %q is not a known label", label)
			}
		}
		if !inUnitRange(s.scriptedConfidence) {
			return nil, errors.New("scripted confidence must be within [0, 1]")
		}
	}
	return s, nil
}

// Labels implements Classifier.
func (s *StubClassifier) Labels() []string { return append([]string(nil), s.labels...) }

// FeatureDim implements Classifier.
func (s *StubClassifier) FeatureDim() int { return s.featureDim }

// Predict implements Classifier.
func (s *StubClassifier) Predict(features []float32) (ClassifierOutput, error) {
	if len(features) != s.featureDim {
		return ClassifierOutput{}, fmt.Errorf("expected %d features, got %d", s.featureDim, len(features))
	}

	packed := make([]byte, 4*len(features))
	for i, v := range features {
		if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) {
			return ClassifierOutput{}, errors.New("features must be finite")
		}
		binary.LittleEndian.PutUint32(packed[4*i:], math.Float32bits(v))
	}
	digest := sha256.Sum256(packed)

	var winner, units int
	if s.script == nil {
		winner = int(binary.LittleEndian.Uint32(digest[0:4]) % uint32(len(s.labels)))
		units = stubHashConfidenceMin +
			int(binary.LittleEndian.Uint16(digest[4:6]))*stubHashConfidenceSpan/0xFFFF
	} else {
		s.mu.Lock()
		label := s.script[s.scriptPos%len(s.script)]
		s.scriptPos++
		s.mu.Unlock()
		winner = s.labelIndex[label]
		units = int(s.scriptedConfidence*stubScale + 0.5)
	}

	return s.buildOutput(winner, units, digest), nil
}

func (s *StubClassifier) buildOutput(winner, units int, digest [sha256.Size]byte) ClassifierOutput {
	n := len(s.labels)
	used := map[int]bool{winner: true}
	runnerUps := make([]int, 0, s.topK-1)
	for i := 0; i < s.topK-1; i++ {
		candidate := int(binary.LittleEndian.Uint16(digest[6+2*i:8+2*i])) % n
		for used[candidate] {
			candidate = (candidate + 1) % n
		}
		used[candidate] = true
		runnerUps = append(runnerUps, candidate)
	}

	entries := make([]TopKEntry, 0, s.topK)
	entries = append(entries, TopKEntry{Label: s.labels[winner], Confidence: float64(units) / stubScale})

	// Runner-ups take 60%, then 40% of that, ... of the remaining probability
	// mass, capped at the winner's confidence so top_k stays ranked best-first
	// even when a scripted confidence is low.
	share := min((stubScale-units)*6/10, units)
	for _, index := range runnerUps {
		entries = append(entries, TopKEntry{Label: s.labels[index], Confidence: float64(share) / stubScale})
		share = share * 4 / 10
	}

	return ClassifierOutput{
		Label:       s.labels[winner],
		Confidence:  float64(units) / stubScale,
		TopK:        entries,
		InferenceMs: stubInferenceMs,
	}
}
