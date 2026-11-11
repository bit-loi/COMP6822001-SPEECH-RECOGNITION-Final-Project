package voice

import (
	"encoding/binary"
	"testing"
)

const streamTestMap = `{
	"commands": {
		"go": {"action": "execute_active_file"},
		"left": {"action": "switch_tab", "params": {"direction": "left"}}
	},
	"no_action": ["cat", "silence", "unknown"]
}`

func streamTestMapper(t *testing.T) *CommandMapper {
	t.Helper()
	mapper, err := NewCommandMapperFromJSON([]byte(streamTestMap), nil)
	if err != nil {
		t.Fatalf("mapper: %v", err)
	}
	return mapper
}

func newScriptStreamer(t *testing.T, label string, confidence float64) *Streamer {
	t.Helper()
	stub, err := NewStubClassifier(WithScript(label), WithScriptedConfidence(confidence))
	if err != nil {
		t.Fatalf("stub: %v", err)
	}
	streamer, err := NewStreamer(stub, streamTestMapper(t))
	if err != nil {
		t.Fatalf("streamer: %v", err)
	}
	return streamer
}

// squareWave returns n samples alternating between +amplitude and -amplitude.
func squareWave(n int, amplitude int16) []int16 {
	samples := make([]int16, n)
	for i := range samples {
		if i%2 == 0 {
			samples[i] = amplitude
		} else {
			samples[i] = -amplitude
		}
	}
	return samples
}

func toPCM16(samples []int16) []byte {
	data := make([]byte, 2*len(samples))
	for i, sample := range samples {
		binary.LittleEndian.PutUint16(data[2*i:], uint16(sample))
	}
	return data
}

func toFloat32Samples(samples []int16) []float32 {
	out := make([]float32, len(samples))
	for i, sample := range samples {
		out[i] = float32(sample) * SampleScale
	}
	return out
}

func concatenate(parts ...[]int16) []int16 {
	var all []int16
	for _, part := range parts {
		all = append(all, part...)
	}
	return all
}

// feedPCM sends the audio in 200 ms chunks, like the browser will.
func feedPCM(streamer *Streamer, samples []int16) []StreamEvent {
	chunk := 200 * SampleRate / 1000
	var events []StreamEvent
	for start := 0; start < len(samples); start += chunk {
		end := min(start+chunk, len(samples))
		events = append(events, streamer.WritePCM(toPCM16(samples[start:end]))...)
	}
	return events
}

func countKind(events []StreamEvent, kind StreamEventKind) int {
	count := 0
	for _, event := range events {
		if event.Kind == kind {
			count++
		}
	}
	return count
}

func TestStreamerRecognisesAnUtteranceEndToEnd(t *testing.T) {
	streamer := newScriptStreamer(t, "go", 0.9)
	samples := concatenate(
		squareWave(4800, 10),   // 300 ms quiet
		squareWave(9600, 8000), // 600 ms loud
		squareWave(6400, 10),   // 400 ms quiet -> hangover ends the utterance
	)

	events := feedPCM(streamer, samples)

	if countKind(events, StreamSpeechStart) != 1 {
		t.Fatalf("speech starts = %d, want 1", countKind(events, StreamSpeechStart))
	}
	if countKind(events, StreamResult) != 1 {
		t.Fatalf("results = %d, want 1", countKind(events, StreamResult))
	}
	for _, event := range events {
		if event.Kind != StreamResult {
			continue
		}
		if event.Output == nil || event.Mapping == nil {
			t.Fatal("result event is missing output or mapping")
		}
		if event.Output.Label != "go" || event.Mapping.Label != "go" {
			t.Fatalf("label = %q/%q", event.Output.Label, event.Mapping.Label)
		}
		if event.Mapping.Reason != ReasonMapped {
			t.Fatalf("reason = %q", event.Mapping.Reason)
		}
		if event.Mapping.Action == nil || event.Mapping.Action.Action != "execute_active_file" {
			t.Fatalf("action = %+v", event.Mapping.Action)
		}
	}
}

func TestStreamerAppliesTheConfidenceThreshold(t *testing.T) {
	streamer := newScriptStreamer(t, "go", 0.5)
	samples := concatenate(squareWave(4800, 10), squareWave(9600, 8000), squareWave(6400, 10))

	result := findResult(t, feedPCM(streamer, samples))
	if result.Mapping.Reason != ReasonBelowThreshold {
		t.Fatalf("reason = %q", result.Mapping.Reason)
	}
	if result.Mapping.Action != nil {
		t.Fatal("below threshold must not produce an action")
	}
}

func TestStreamerDoesNotActOnNoActionWords(t *testing.T) {
	streamer := newScriptStreamer(t, "cat", 0.99)
	samples := concatenate(squareWave(4800, 10), squareWave(9600, 8000), squareWave(6400, 10))

	result := findResult(t, feedPCM(streamer, samples))
	if result.Mapping.Reason != ReasonNoActionWord || result.Mapping.Action != nil {
		t.Fatalf("unexpected mapping: %+v", result.Mapping)
	}
}

func TestStreamerDiscardsClicksAndCoughs(t *testing.T) {
	streamer := newScriptStreamer(t, "go", 0.9)
	samples := concatenate(
		squareWave(4800, 10),
		squareWave(800, 8000), // 50 ms burst, below VADMinSpeechMs
		squareWave(6400, 10),
	)

	events := feedPCM(streamer, samples)
	if countKind(events, StreamResult) != 0 {
		t.Fatalf("results = %d, want 0", countKind(events, StreamResult))
	}
}

func TestStreamerFlushClassifiesImmediately(t *testing.T) {
	streamer := newScriptStreamer(t, "left", 0.99)
	samples := concatenate(squareWave(4800, 10), squareWave(9600, 8000))

	events := feedPCM(streamer, samples)
	if countKind(events, StreamResult) != 0 {
		t.Fatal("utterance ended before the flush")
	}
	events = streamer.Flush()
	result := findResult(t, events)
	if result.Mapping.Action == nil || result.Mapping.Action.Action != "switch_tab" ||
		result.Mapping.Action.Params["direction"] != "left" {
		t.Fatalf("unexpected mapping: %+v", result.Mapping)
	}
}

func TestStreamerCarriesSplitSamplesBetweenCalls(t *testing.T) {
	streamer := newScriptStreamer(t, "go", 0.9)
	samples := concatenate(squareWave(4800, 10), squareWave(9600, 8000), squareWave(6400, 10))
	data := toPCM16(samples)

	var events []StreamEvent
	for start := 0; start < len(data); start += 3 { // odd chunks split samples
		end := min(start+3, len(data))
		events = append(events, streamer.WritePCM(data[start:end])...)
	}
	if countKind(events, StreamResult) != 1 {
		t.Fatalf("results = %d, want 1", countKind(events, StreamResult))
	}
}

func TestStreamerProducesNothingForDigitalSilence(t *testing.T) {
	streamer := newScriptStreamer(t, "go", 0.9)
	events := streamer.WritePCM(toPCM16(make([]int16, 16000)))
	if len(events) != 0 {
		t.Fatalf("events = %d, want 0", len(events))
	}
}

func TestStreamerRejectsFeatureDimMismatch(t *testing.T) {
	stub, err := NewStubClassifier(WithFeatureDim(FeatureDim - 1))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewStreamer(stub, streamTestMapper(t)); err == nil {
		t.Fatal("expected an error")
	}
}

func TestStreamerWorksWithTheRealMapAndHashStub(t *testing.T) {
	mapper, err := LoadCommandMapper(nil)
	if err != nil {
		t.Fatal(err)
	}
	stub, err := NewStubClassifier()
	if err != nil {
		t.Fatal(err)
	}
	streamer, err := NewStreamer(stub, mapper)
	if err != nil {
		t.Fatal(err)
	}

	samples := concatenate(squareWave(4800, 10), squareWave(9600, 8000), squareWave(6400, 10))
	result := findResult(t, feedPCM(streamer, samples))

	if len(result.Output.TopK) != TopK {
		t.Fatalf("top_k = %d, want %d", len(result.Output.TopK), TopK)
	}
	if err := result.Output.Validate(); err != nil {
		t.Fatalf("output violates the contract: %v", err)
	}
	switch result.Mapping.Reason {
	case ReasonMapped, ReasonBelowThreshold, ReasonNoActionWord:
	default:
		t.Fatalf("reason = %q", result.Mapping.Reason)
	}
}

func findResult(t *testing.T, events []StreamEvent) *StreamEvent {
	t.Helper()
	for i := range events {
		if events[i].Kind == StreamResult {
			return &events[i]
		}
	}
	t.Fatal("no result event")
	return nil
}
