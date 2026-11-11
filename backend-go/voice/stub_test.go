package voice

import (
	"reflect"
	"sync"
	"testing"
)

// ramp / mod11 build the same feature vectors as the Python tests do.
func ramp(offset float64) []float32 {
	features := make([]float32, FeatureDim)
	for i := range features {
		features[i] = float32(float64(i)*0.25 - 10.0 + offset)
	}
	return features
}

func mod11() []float32 {
	features := make([]float32, FeatureDim)
	for i := range features {
		features[i] = float32(float64((i*37)%11)/7.0 - 0.5)
	}
	return features
}

func mustStub(t *testing.T, opts ...StubOption) *StubClassifier {
	t.Helper()
	stub, err := NewStubClassifier(opts...)
	if err != nil {
		t.Fatal(err)
	}
	return stub
}

func mustPredict(t *testing.T, c Classifier, features []float32) ClassifierOutput {
	t.Helper()
	out, err := c.Predict(features)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// Golden vectors: backend-python/tests/test_stub_classifier.py pins the same
// three, so the Python and Go stubs are guaranteed to agree bit-for-bit.
func TestGoldenVectorsMatchThePythonStub(t *testing.T) {
	cases := []struct {
		name     string
		features []float32
		want     ClassifierOutput
	}{
		{"ramp", ramp(0), ClassifierOutput{
			Label: "marvin", Confidence: 0.6133, InferenceMs: 0.5,
			TopK: []TopKEntry{{"marvin", 0.6133}, {"wow", 0.232}, {"learn", 0.0928}},
		}},
		{"zeros", make([]float32, FeatureDim), ClassifierOutput{
			Label: "three", Confidence: 0.9591, InferenceMs: 0.5,
			TopK: []TopKEntry{{"three", 0.9591}, {"nine", 0.0245}, {"one", 0.0098}},
		}},
		{"mod11", mod11(), ClassifierOutput{
			Label: "silence", Confidence: 0.9819, InferenceMs: 0.5,
			TopK: []TopKEntry{{"silence", 0.9819}, {"down", 0.0108}, {"cat", 0.0043}},
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := mustPredict(t, mustStub(t), tc.features)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got  %+v\nwant %+v", got, tc.want)
			}
		})
	}
}

func TestStubImplementsClassifier(t *testing.T) {
	var c Classifier = mustStub(t)
	if c.FeatureDim() != FeatureDim {
		t.Fatalf("feature dim = %d", c.FeatureDim())
	}
	if !reflect.DeepEqual(c.Labels(), Labels()) {
		t.Fatal("stub labels must equal the package labels")
	}
}

func TestSameFeaturesAlwaysGiveTheSamePrediction(t *testing.T) {
	first := mustPredict(t, mustStub(t), ramp(0))
	second := mustPredict(t, mustStub(t), ramp(0))
	other := mustStub(t)
	mustPredict(t, other, ramp(1)) // an unrelated call in between changes nothing
	third := mustPredict(t, other, ramp(0))

	if !reflect.DeepEqual(first, second) || !reflect.DeepEqual(first, third) {
		t.Fatal("stub output must be a pure function of the features")
	}
}

func TestHashModeSpreadsOverTheLabelSet(t *testing.T) {
	stub := mustStub(t)
	seen := map[string]bool{}
	for n := 0; n < 1000; n++ {
		seen[mustPredict(t, stub, ramp(float64(n)*0.37)).Label] = true
	}
	if len(seen) < 30 {
		t.Fatalf("only %d distinct labels over 1000 inputs", len(seen))
	}
}

func TestOutputsAlwaysSatisfyTheContract(t *testing.T) {
	stub := mustStub(t)
	for _, offset := range []float64{0, 0.5, 3, -7, 123.456} {
		out := mustPredict(t, stub, ramp(offset))
		if err := out.Validate(); err != nil {
			t.Fatalf("offset %v: %v", offset, err)
		}
		if len(out.TopK) != TopK {
			t.Fatalf("expected %d top_k entries, got %d", TopK, len(out.TopK))
		}
		if out.Confidence < 0.5 || out.Confidence > 0.99 {
			t.Fatalf("hash-mode confidence %v outside [0.5, 0.99]", out.Confidence)
		}
		labels := map[string]bool{}
		for _, entry := range out.TopK {
			labels[entry.Label] = true
		}
		if len(labels) != len(out.TopK) {
			t.Fatalf("top_k labels are not unique: %+v", out.TopK)
		}
	}
}

func TestTopKIsConfigurable(t *testing.T) {
	for _, k := range []int{1, 2, 5, 10} {
		out := mustPredict(t, mustStub(t, WithTopK(k)), ramp(0))
		if len(out.TopK) != k {
			t.Errorf("top_k=%d produced %d entries", k, len(out.TopK))
		}
		if err := out.Validate(); err != nil {
			t.Errorf("top_k=%d: %v", k, err)
		}
	}
	for _, k := range []int{0, -1, 11, 100} {
		if _, err := NewStubClassifier(WithTopK(k)); err == nil {
			t.Errorf("top_k=%d should be rejected", k)
		}
	}
}

func TestWrongFeatureLengthIsRejected(t *testing.T) {
	stub := mustStub(t)
	for _, n := range []int{0, 1, 77, 79, 156} {
		if _, err := stub.Predict(make([]float32, n)); err == nil {
			t.Errorf("length %d should be rejected", n)
		}
	}
}

func TestNonFiniteFeaturesAreRejected(t *testing.T) {
	stub := mustStub(t)
	inf := float32(1) / float32(zero())
	for name, bad := range map[string]float32{"nan": inf - inf, "+inf": inf, "-inf": -inf} {
		features := ramp(0)
		features[10] = bad
		if _, err := stub.Predict(features); err == nil {
			t.Errorf("%s should be rejected", name)
		}
	}
}

// zero defeats constant folding so 1/zero is a runtime +Inf, not a compile error.
func zero() int { return 0 }

func TestScriptModeCyclesInOrder(t *testing.T) {
	stub := mustStub(t, WithScript("go", "stop", "left"))
	var got []string
	for n := 0; n < 7; n++ {
		got = append(got, mustPredict(t, stub, ramp(float64(n))).Label)
	}
	want := []string{"go", "stop", "left", "go", "stop", "left", "go"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestScriptModeUsesTheConfiguredConfidence(t *testing.T) {
	if got := mustPredict(t, mustStub(t, WithScript("go"), WithScriptedConfidence(0.8)), ramp(0)).Confidence; got != 0.8 {
		t.Errorf("confidence = %v, want 0.8", got)
	}
	if got := mustPredict(t, mustStub(t, WithScript("go")), ramp(0)).Confidence; got != 0.9 {
		t.Errorf("default scripted confidence = %v, want 0.9", got)
	}
}

func TestScriptModeKeepsTopKValidAtAnyConfidence(t *testing.T) {
	for _, confidence := range []float64{0, 0.1, 0.3, 0.5, 1} {
		out := mustPredict(t, mustStub(t, WithScript("go"), WithScriptedConfidence(confidence)), ramp(0))
		if err := out.Validate(); err != nil {
			t.Errorf("confidence %v: %v", confidence, err)
		}
		if out.TopK[0].Label != "go" {
			t.Errorf("confidence %v: head = %q", confidence, out.TopK[0].Label)
		}
	}
}

func TestScriptModeIsSafeForConcurrentUse(t *testing.T) {
	stub := mustStub(t, WithScript("go", "stop"))
	var (
		wg     sync.WaitGroup
		mu     sync.Mutex
		counts = map[string]int{}
	)
	for worker := 0; worker < 4; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for n := 0; n < 250; n++ {
				label := mustPredict(t, stub, ramp(0)).Label
				mu.Lock()
				counts[label]++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if counts["go"] != 500 || counts["stop"] != 500 {
		t.Fatalf("script positions were lost under concurrency: %v", counts)
	}
}

func TestInvalidStubConstructionIsRejected(t *testing.T) {
	cases := map[string][]StubOption{
		"empty script":             {WithScript()},
		"unknown script label":     {WithScript("not-a-label")},
		"confidence above 1":       {WithScript("go"), WithScriptedConfidence(1.5)},
		"confidence below 0":       {WithScript("go"), WithScriptedConfidence(-0.1)},
		"no labels":                {WithLabels(nil)},
		"duplicate labels":         {WithLabels([]string{"a", "a"})},
		"non-positive feature dim": {WithFeatureDim(0)},
	}
	for name, opts := range cases {
		if _, err := NewStubClassifier(opts...); err == nil {
			t.Errorf("%s should be rejected", name)
		}
	}
}
