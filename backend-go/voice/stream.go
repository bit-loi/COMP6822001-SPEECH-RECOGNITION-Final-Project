package voice

import (
	"encoding/binary"
	"errors"
)

// StreamEventKind says what happened while feeding audio to a Streamer.
type StreamEventKind int

const (
	// StreamSpeechStart: the VAD just detected the beginning of an utterance.
	StreamSpeechStart StreamEventKind = iota + 1
	// StreamResult: an utterance was classified and mapped.
	StreamResult
	// StreamError: classification failed; the stream itself is still usable.
	StreamError
)

// StreamEvent is one observable step of the streaming pipeline.
type StreamEvent struct {
	Kind StreamEventKind

	// Output and Mapping are set for StreamResult.
	Output  *ClassifierOutput
	Mapping *MapResult

	// Err is set for StreamError.
	Err error
}

// Streamer is the per-connection audio pipeline: PCM in, VAD utterances,
// MFCC features, classifier prediction and command mapping out.
//
// It is not safe for concurrent use; create one per WebSocket connection.
// The classifier and mapper are shared and must be safe for concurrent use
// (Classifier requires that, CommandMapper is immutable).
type Streamer struct {
	vad       *VAD
	extractor *FeatureExtractor

	classifier Classifier
	mapper     *CommandMapper

	pending   []float32
	byteCarry []byte
	history   [][]float32
	utt       [][]float32
	preRoll   int
}

// historyFrames is enough audio to prepend the pre-roll plus the frames the VAD
// needed before it could declare the onset.
const historyFrames = PreRollFrames + VADStartFrames

// NewStreamer validates the collaborators and returns an idle pipeline.
func NewStreamer(classifier Classifier, mapper *CommandMapper) (*Streamer, error) {
	if classifier == nil {
		return nil, errors.New("classifier is required")
	}
	if mapper == nil {
		return nil, errors.New("command mapper is required")
	}
	if classifier.FeatureDim() != FeatureDim {
		return nil, errors.New("classifier feature dim does not match the extractor")
	}
	return &Streamer{
		vad:        NewVAD(),
		extractor:  NewFeatureExtractor(),
		classifier: classifier,
		mapper:     mapper,
	}, nil
}

// WritePCM appends signed 16-bit little-endian mono PCM and returns whatever
// events the complete frames produced. A trailing odd byte is carried over to
// the next call.
func (s *Streamer) WritePCM(pcm []byte) []StreamEvent {
	data := pcm
	if len(s.byteCarry) > 0 {
		data = append(append([]byte(nil), s.byteCarry...), pcm...)
		s.byteCarry = nil
	}

	n := len(data) - len(data)%2
	samples := make([]float32, n/2)
	for i := 0; i < n; i += 2 {
		value := int16(binary.LittleEndian.Uint16(data[i : i+2]))
		samples[i/2] = float32(value) * SampleScale
	}
	if n < len(data) {
		s.byteCarry = []byte{data[n]}
	}
	return s.WriteSamples(samples)
}

// WriteSamples appends already-scaled mono samples (full scale +-1.0).
func (s *Streamer) WriteSamples(samples []float32) []StreamEvent {
	var events []StreamEvent
	s.pending = append(s.pending, samples...)

	consumed := 0
	for len(s.pending)-consumed >= FrameHop {
		frame := make([]float32, FrameHop)
		copy(frame, s.pending[consumed:consumed+FrameHop])
		consumed += FrameHop
		events = append(events, s.processFrame(frame)...)
	}

	if consumed == len(s.pending) {
		s.pending = s.pending[:0]
	} else if consumed > 0 {
		remaining := copy(s.pending, s.pending[consumed:])
		s.pending = s.pending[:remaining]
	}
	return events
}

// Flush ends an utterance in progress right now, e.g. when the user stops
// recording. A partial frame still in the buffer is discarded.
func (s *Streamer) Flush() []StreamEvent {
	s.pending = s.pending[:0]
	s.byteCarry = nil

	event := s.vad.Flush()
	if event.Kind != VADSpeechEnd {
		return nil
	}
	return s.finishUtterance(event)
}

func (s *Streamer) processFrame(frame []float32) []StreamEvent {
	s.history = append(s.history, frame)
	if len(s.history) > historyFrames {
		s.history = s.history[len(s.history)-historyFrames:]
	}

	wasInSpeech := s.vad.InSpeech()
	if wasInSpeech {
		s.utt = append(s.utt, frame)
	}

	event := s.vad.Process(frame)
	switch event.Kind {
	case VADSpeechStart:
		// The onset started event.Lookback frames ago; keep that plus the
		// pre-roll so the feature extractor sees context on both sides.
		take := PreRollFrames + event.Lookback + 1
		if take > len(s.history) {
			take = len(s.history)
		}
		s.utt = make([][]float32, take)
		copy(s.utt, s.history[len(s.history)-take:])
		s.preRoll = take - (event.Lookback + 1)
		return []StreamEvent{{Kind: StreamSpeechStart}}

	case VADSpeechEnd:
		return s.finishUtterance(event)
	}
	return nil
}

func (s *Streamer) finishUtterance(event VADEvent) []StreamEvent {
	utterance := s.utt
	preRoll := s.preRoll
	s.utt = nil
	s.preRoll = 0

	if event.Discarded || len(utterance) == 0 {
		return nil
	}

	keep := len(utterance)
	if event.Reason != EndMaxLength {
		keep = preRoll + event.SpeechFrames + TailFrames
		if keep > len(utterance) {
			keep = len(utterance)
		}
	}

	samples := make([]float32, 0, keep*FrameHop)
	for _, frame := range utterance[:keep] {
		samples = append(samples, frame...)
	}

	output, err := s.classifier.Predict(s.extractor.ExtractFeatures(samples))
	if err != nil {
		return []StreamEvent{{Kind: StreamError, Err: err}}
	}
	mapping := s.mapper.MapOutput(output)
	return []StreamEvent{{
		Kind:    StreamResult,
		Output:  &output,
		Mapping: &mapping,
	}}
}
