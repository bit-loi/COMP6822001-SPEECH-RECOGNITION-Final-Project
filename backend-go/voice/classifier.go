package voice

import (
	"errors"
	"fmt"
	"math"
)

// TopKEntry is one ranked candidate of a prediction.
type TopKEntry struct {
	Label      string  `json:"label"`
	Confidence float64 `json:"confidence"`
}

// ClassifierOutput is the output contract every classifier must honour. It is
// the Go mirror of ClassifierOutput in backend-python/models/classifier_schemas.py
// and serialises to:
//
//	{"label": "go", "confidence": 0.93,
//	 "top_k": [{"label": "go", "confidence": 0.93}, ...],
//	 "inference_ms": 1.2}
type ClassifierOutput struct {
	Label       string      `json:"label"`
	Confidence  float64     `json:"confidence"`
	TopK        []TopKEntry `json:"top_k"`
	InferenceMs float64     `json:"inference_ms"`
}

// Validate enforces the same rules as the pydantic model: probabilities within
// [0, 1], a non-negative latency, and a non-empty top_k ranked best-first whose
// head is the predicted label.
func (o ClassifierOutput) Validate() error {
	if !inUnitRange(o.Confidence) {
		return fmt.Errorf("confidence %v is outside [0, 1]", o.Confidence)
	}
	if math.IsNaN(o.InferenceMs) || o.InferenceMs < 0 {
		return fmt.Errorf("inference_ms %v must be >= 0", o.InferenceMs)
	}
	if len(o.TopK) == 0 {
		return errors.New("top_k must not be empty")
	}
	for i, entry := range o.TopK {
		if !inUnitRange(entry.Confidence) {
			return fmt.Errorf("top_k[%d] confidence %v is outside [0, 1]", i, entry.Confidence)
		}
		if i > 0 && entry.Confidence > o.TopK[i-1].Confidence {
			return errors.New("top_k must be sorted by confidence, highest first")
		}
	}
	head := o.TopK[0]
	if head.Label != o.Label || math.Abs(head.Confidence-o.Confidence) > 1e-9 {
		return errors.New("top_k[0] must equal the predicted label and confidence")
	}
	return nil
}

func inUnitRange(v float64) bool {
	return v >= 0 && v <= 1 // false for NaN
}

// Classifier maps one pooled utterance feature vector to a ranked keyword
// prediction. A real trained model plugs in by implementing this interface; the
// rest of the pipeline does not change.
//
// Implementations must be safe for concurrent use (one classifier is shared by
// every WebSocket connection) and must return an error, never silently pad or
// truncate, when len(features) != FeatureDim().
type Classifier interface {
	// Labels returns the class labels in the model's output order.
	Labels() []string
	// FeatureDim is the length of the vector Predict expects.
	FeatureDim() int
	// Predict classifies features (see FeatureDim in params.go for the layout).
	Predict(features []float32) (ClassifierOutput, error)
}
