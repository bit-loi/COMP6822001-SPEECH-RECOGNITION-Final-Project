package voice

import (
	"encoding/json"
	"math"
	"os"
	"testing"
)

// The golden vectors in testdata/mfcc_golden.json are produced by
// testdata/generate_mfcc_golden.py with python_speech_features 0.6.1 and
// numpy.hamming, i.e. the training-side reference implementation.
type mfccGolden struct {
	Frames     int       `json:"frames"`
	FirstFrame []float64 `json:"first_frame"`
	Pooled     []float64 `json:"pooled"`
}

func loadMFCCGolden(t *testing.T) map[string]mfccGolden {
	t.Helper()
	data, err := os.ReadFile("testdata/mfcc_golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var golden map[string]mfccGolden
	if err := json.Unmarshal(data, &golden); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return golden
}

func lcgSignal(n int, seed uint64, span, offset int) []float32 {
	state := seed
	samples := make([]float32, n)
	for i := range samples {
		state = (state*1103515245 + 12345) % 2147483648
		samples[i] = float32(int(state%uint64(span))-offset) * SampleScale
	}
	return samples
}

func closeEnough(got, want, tolerance float64) bool {
	return math.Abs(got-want) <= tolerance*math.Max(1, math.Abs(want))
}

func TestMFCCMatchesPythonGoldenVectors(t *testing.T) {
	golden := loadMFCCGolden(t)
	extractor := NewFeatureExtractor()

	cases := map[string][]float32{
		"noise":           lcgSignal(8000, 123456789, 65536, 32768),
		"quiet":           lcgSignal(6000, 987654321, 2000, 1000),
		"short":           lcgSignal(401, 42, 65536, 32768),
		"one_frame":       lcgSignal(400, 7, 65536, 32768),
		"digital_silence": make([]float32, 800),
	}

	for name, samples := range cases {
		want, ok := golden[name]
		if !ok {
			t.Fatalf("%s: missing golden case", name)
		}
		t.Run(name, func(t *testing.T) {
			sequence := extractor.ExtractSequence(samples)
			if len(sequence) != want.Frames {
				t.Fatalf("frames = %d, want %d", len(sequence), want.Frames)
			}
			if len(sequence[0]) != NumFeatureChannels {
				t.Fatalf("channels = %d, want %d", len(sequence[0]), NumFeatureChannels)
			}
			if len(want.FirstFrame) != NumFeatureChannels {
				t.Fatalf("golden first frame has %d values", len(want.FirstFrame))
			}
			for i, expected := range want.FirstFrame {
				if !closeEnough(sequence[0][i], expected, 1e-9) {
					t.Errorf("first frame[%d] = %.15g, want %.15g", i, sequence[0][i], expected)
				}
			}

			pooled := poolFeatures(sequence)
			if len(pooled) != FeatureDim || len(want.Pooled) != FeatureDim {
				t.Fatalf("pooled dims = %d/%d, want %d", len(pooled), len(want.Pooled), FeatureDim)
			}
			for i, expected := range want.Pooled {
				if !closeEnough(float64(pooled[i]), expected, 1e-5) {
					t.Errorf("pooled[%d] = %.9g, want %.9g", i, pooled[i], expected)
				}
			}
		})
	}
}

func TestExtractFeaturesShapeAndFiniteness(t *testing.T) {
	extractor := NewFeatureExtractor()
	features := extractor.ExtractFeatures(lcgSignal(4000, 1, 65536, 32768))
	if len(features) != FeatureDim {
		t.Fatalf("len = %d, want %d", len(features), FeatureDim)
	}
	for i, v := range features {
		if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) {
			t.Fatalf("feature %d is not finite: %v", i, v)
		}
	}
}

func TestExtractFeaturesIsDeterministic(t *testing.T) {
	extractor := NewFeatureExtractor()
	samples := lcgSignal(3200, 99, 65536, 32768)
	first := extractor.ExtractFeatures(samples)
	second := extractor.ExtractFeatures(samples)
	for i := range first {
		if first[i] != second[i] {
			t.Fatalf("feature %d differs between runs: %v vs %v", i, first[i], second[i])
		}
	}
}

func TestFrameSignalMatchesPythonFraming(t *testing.T) {
	// python_speech_features.framesig: 400-sample window, 160-sample hop,
	// zero-padded final partial frame; a signal shorter than a window still
	// yields one frame.
	tests := []struct {
		samples int
		frames  int
	}{
		{0, 0},
		{1, 1},
		{399, 1},
		{400, 1},
		{401, 2},
		{559, 2},
		{560, 2},
		{561, 3},
	}
	for _, tc := range tests {
		signal := make([]float64, tc.samples)
		if got := len(frameSignal(signal, MFCCWindowSamples, FrameHop)); got != tc.frames {
			t.Errorf("%d samples: frames = %d, want %d", tc.samples, got, tc.frames)
		}
	}
}
