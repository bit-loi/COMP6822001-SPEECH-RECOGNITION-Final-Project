package voice

import (
	"encoding/json"
	"math"
	"reflect"
	"sort"
	"testing"
)

func validOutput() ClassifierOutput {
	return ClassifierOutput{
		Label:      "go",
		Confidence: 0.9,
		TopK: []TopKEntry{
			{Label: "go", Confidence: 0.9},
			{Label: "no", Confidence: 0.06},
			{Label: "on", Confidence: 0.02},
		},
		InferenceMs: 1.5,
	}
}

func TestLabelsAreThe37ClassesInTrainingOrder(t *testing.T) {
	got := Labels()
	if len(got) != 37 {
		t.Fatalf("expected 37 labels, got %d", len(got))
	}
	if !sort.StringsAreSorted(got) {
		t.Errorf("labels must be alphabetical (training order): %v", got)
	}
	seen := map[string]bool{}
	for _, l := range got {
		if seen[l] {
			t.Errorf("duplicate label %q", l)
		}
		seen[l] = true
	}
	for _, want := range []string{"silence", "unknown", "go", "zero", "marvin"} {
		if !seen[want] {
			t.Errorf("missing label %q", want)
		}
	}
}

func TestLabelsReturnsACopy(t *testing.T) {
	first := Labels()
	first[0] = "tampered"
	if Labels()[0] != "backward" {
		t.Fatal("mutating the returned slice must not change the package labels")
	}
}

func TestFeatureDimIs78(t *testing.T) {
	if FeatureDim != 78 || NumFeatureChannels != 39 || NumCepstra != 13 {
		t.Fatalf("unexpected feature layout: dim=%d channels=%d cepstra=%d",
			FeatureDim, NumFeatureChannels, NumCepstra)
	}
}

func TestValidOutputPasses(t *testing.T) {
	if err := validOutput().Validate(); err != nil {
		t.Fatalf("expected valid output, got %v", err)
	}
}

func TestInvalidOutputsAreRejected(t *testing.T) {
	cases := map[string]func(*ClassifierOutput){
		"confidence above 1":      func(o *ClassifierOutput) { o.Confidence = 1.2 },
		"confidence below 0":      func(o *ClassifierOutput) { o.Confidence = -0.1 },
		"confidence NaN":          func(o *ClassifierOutput) { o.Confidence = math.NaN() },
		"negative inference":      func(o *ClassifierOutput) { o.InferenceMs = -1 },
		"NaN inference":           func(o *ClassifierOutput) { o.InferenceMs = math.NaN() },
		"empty top_k":             func(o *ClassifierOutput) { o.TopK = nil },
		"unsorted top_k":          func(o *ClassifierOutput) { o.TopK[1].Confidence = 0.95 },
		"head label differs":      func(o *ClassifierOutput) { o.TopK[0].Label = "no" },
		"head confidence differs": func(o *ClassifierOutput) { o.TopK[0].Confidence = 0.5 },
		"entry confidence > 1":    func(o *ClassifierOutput) { o.TopK[2].Confidence = 1.5 },
		"entry confidence NaN":    func(o *ClassifierOutput) { o.TopK[2].Confidence = math.NaN() },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			out := validOutput()
			mutate(&out)
			if err := out.Validate(); err == nil {
				t.Fatal("expected a validation error")
			}
		})
	}
}

func TestContractSerialisesToTheDocumentedShape(t *testing.T) {
	raw, err := json.Marshal(validOutput())
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}

	keys := make([]string, 0, len(decoded))
	for k := range decoded {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if want := []string{"confidence", "inference_ms", "label", "top_k"}; !reflect.DeepEqual(keys, want) {
		t.Fatalf("top-level keys = %v, want %v", keys, want)
	}

	for _, entry := range decoded["top_k"].([]any) {
		entryKeys := make([]string, 0, 2)
		for k := range entry.(map[string]any) {
			entryKeys = append(entryKeys, k)
		}
		sort.Strings(entryKeys)
		if want := []string{"confidence", "label"}; !reflect.DeepEqual(entryKeys, want) {
			t.Fatalf("top_k entry keys = %v, want %v", entryKeys, want)
		}
	}
}

func TestContractRoundTripsThroughJSON(t *testing.T) {
	raw, err := json.Marshal(validOutput())
	if err != nil {
		t.Fatal(err)
	}
	var back ClassifierOutput
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(back, validOutput()) {
		t.Fatalf("round trip changed the value: %+v", back)
	}
}
