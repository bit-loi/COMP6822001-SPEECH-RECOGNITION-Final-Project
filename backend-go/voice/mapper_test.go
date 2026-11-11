package voice

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
)

// The expectations below restate the specification independently of
// command_map.json, so a typo in the JSON fails here too.
var expectedCommands = map[string]CommandAction{
	"go":       {Action: "execute_active_file", Params: map[string]string{}},
	"stop":     {Action: "stop_execution", Params: map[string]string{}},
	"on":       {Action: "toggle_focus_mode", Params: map[string]string{"direction": "enter"}},
	"off":      {Action: "toggle_focus_mode", Params: map[string]string{"direction": "exit"}},
	"up":       {Action: "scroll", Params: map[string]string{"direction": "up"}},
	"down":     {Action: "scroll", Params: map[string]string{"direction": "down"}},
	"left":     {Action: "switch_tab", Params: map[string]string{"direction": "left"}},
	"right":    {Action: "switch_tab", Params: map[string]string{"direction": "right"}},
	"yes":      {Action: "confirm", Params: map[string]string{}},
	"no":       {Action: "cancel", Params: map[string]string{}},
	"forward":  {Action: "redo", Params: map[string]string{}},
	"backward": {Action: "undo", Params: map[string]string{}},
	"learn":    {Action: "toggle_task_chunking", Params: map[string]string{}},
	"visual":   {Action: "toggle_theme", Params: map[string]string{}},
	"follow":   {Action: "toggle_chat_panel", Params: map[string]string{}},
	"zero":     {Action: "select_tab_0", Params: map[string]string{}},
	"one":      {Action: "select_tab_1", Params: map[string]string{}},
	"two":      {Action: "select_tab_2", Params: map[string]string{}},
	"three":    {Action: "select_tab_3", Params: map[string]string{}},
	"four":     {Action: "select_tab_4", Params: map[string]string{}},
	"five":     {Action: "select_tab_5", Params: map[string]string{}},
	"six":      {Action: "select_tab_6", Params: map[string]string{}},
	"seven":    {Action: "select_tab_7", Params: map[string]string{}},
	"eight":    {Action: "select_tab_8", Params: map[string]string{}},
	"nine":     {Action: "select_tab_9", Params: map[string]string{}},
}

var expectedNoAction = []string{
	"bed", "bird", "cat", "dog", "happy", "house", "marvin", "sheila", "tree", "wow",
	"unknown", "silence",
}

const confident = 0.99

// TestMain keeps a developer's shell from leaking overrides into the tests.
func TestMain(m *testing.M) {
	os.Unsetenv(thresholdEnvVar)
	os.Unsetenv(commandMapEnvVar)
	os.Exit(m.Run())
}

func loadTestMapper(t *testing.T) *CommandMapper {
	t.Helper()
	mapper, err := LoadCommandMapper(nil)
	if err != nil {
		t.Fatalf("load mapper: %v", err)
	}
	return mapper
}

func TestEveryCommandWordMapsToItsAction(t *testing.T) {
	mapper := loadTestMapper(t)
	for label, want := range expectedCommands {
		result := mapper.Map(label, confident)
		if result.Reason != ReasonMapped {
			t.Errorf("%s: reason = %q", label, result.Reason)
			continue
		}
		if result.Action == nil {
			t.Errorf("%s: action is nil", label)
			continue
		}
		if result.Action.Action != want.Action {
			t.Errorf("%s: action = %q, want %q", label, result.Action.Action, want.Action)
		}
		if !reflect.DeepEqual(result.Action.Params, want.Params) {
			t.Errorf("%s: params = %v, want %v", label, result.Action.Params, want.Params)
		}
		if result.Label != label || result.Confidence != confident {
			t.Errorf("%s: label/confidence = %q/%v", label, result.Label, result.Confidence)
		}
	}
}

func TestNoActionWordsNeverTriggerAnything(t *testing.T) {
	mapper := loadTestMapper(t)
	for _, label := range expectedNoAction {
		for _, confidence := range []float64{1.0, 0.9, 0.0} {
			result := mapper.Map(label, confidence)
			if result.Action != nil || result.Reason != ReasonNoActionWord {
				t.Errorf("%s at %v: reason = %q, action = %v", label, confidence, result.Reason, result.Action)
			}
		}
	}
}

func TestMapperKnowsExactlyThe37Classes(t *testing.T) {
	mapper := loadTestMapper(t)
	labels := mapper.Labels()
	if len(labels) != 37 {
		t.Fatalf("labels = %d, want 37", len(labels))
	}
	if !sort.StringsAreSorted(labels) {
		t.Fatalf("labels are not sorted: %v", labels)
	}

	expected := make([]string, 0, 37)
	for label := range expectedCommands {
		expected = append(expected, label)
	}
	expected = append(expected, expectedNoAction...)
	sort.Strings(expected)
	if !reflect.DeepEqual(labels, expected) {
		t.Fatalf("labels = %v, want %v", labels, expected)
	}
}

func TestDefaultThresholdBoundary(t *testing.T) {
	mapper := loadTestMapper(t)
	if mapper.ConfidenceThreshold() != DefaultConfidenceThreshold {
		t.Fatalf("threshold = %v", mapper.ConfidenceThreshold())
	}

	tests := []struct {
		confidence float64
		fires      bool
	}{
		{1.0, true},
		{0.99, true},
		{0.7500001, true},
		{0.75, true}, // inclusive
		{0.7499999, false},
		{0.5, false},
		{0.0, false},
	}
	for _, tc := range tests {
		result := mapper.Map("go", tc.confidence)
		if fires := result.Action != nil; fires != tc.fires {
			t.Errorf("%v: fires = %v, want %v", tc.confidence, fires, tc.fires)
		}
		wantReason := ReasonBelowThreshold
		if tc.fires {
			wantReason = ReasonMapped
		}
		if result.Reason != wantReason {
			t.Errorf("%v: reason = %q, want %q", tc.confidence, result.Reason, wantReason)
		}
	}
}

func TestThresholdPrecedence(t *testing.T) {
	t.Setenv(thresholdEnvVar, "0.9")
	mapper := loadTestMapper(t)
	if mapper.ConfidenceThreshold() != 0.9 {
		t.Fatalf("env threshold = %v", mapper.ConfidenceThreshold())
	}

	explicit := 0.3
	mapper, err := LoadCommandMapper(&explicit)
	if err != nil {
		t.Fatal(err)
	}
	if mapper.ConfidenceThreshold() != 0.3 {
		t.Fatalf("explicit threshold = %v", mapper.ConfidenceThreshold())
	}

	t.Setenv(thresholdEnvVar, "   ")
	mapper = loadTestMapper(t)
	if mapper.ConfidenceThreshold() != DefaultConfidenceThreshold {
		t.Fatalf("blank env threshold = %v", mapper.ConfidenceThreshold())
	}
}

func TestBadEnvironmentThresholdIsReported(t *testing.T) {
	t.Setenv(commandMapEnvVar, "")
	for _, raw := range []string{"abc", "1.5", "-0.2"} {
		t.Setenv(thresholdEnvVar, raw)
		if _, err := LoadCommandMapper(nil); err == nil {
			t.Errorf("%q: expected an error", raw)
		}
	}
}

func TestOutOfRangeExplicitThresholdIsRejected(t *testing.T) {
	t.Setenv(thresholdEnvVar, "")
	t.Setenv(commandMapEnvVar, "")
	for _, value := range []float64{-0.01, 1.01, 5} {
		v := value
		if _, err := LoadCommandMapper(&v); err == nil {
			t.Errorf("%v: expected an error", value)
		}
	}
}

func TestThresholdCanComeFromTheJSONFile(t *testing.T) {
	t.Setenv(thresholdEnvVar, "")
	t.Setenv(commandMapEnvVar, "")
	path := filepath.Join(t.TempDir(), "map.json")
	document := `{"confidence_threshold": 0.6,
		"commands": {"go": {"action": "execute_active_file"}},
		"no_action": ["cat"]}`
	if err := os.WriteFile(path, []byte(document), 0o600); err != nil {
		t.Fatal(err)
	}

	mapper, err := NewCommandMapperFromFile(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if mapper.ConfidenceThreshold() != 0.6 {
		t.Fatalf("threshold = %v", mapper.ConfidenceThreshold())
	}
	if mapper.Map("go", 0.65).Action == nil || mapper.Map("go", 0.55).Action != nil {
		t.Fatal("threshold from the file was not applied")
	}
}

func TestLabelsMustMatchExactly(t *testing.T) {
	mapper := loadTestMapper(t)
	for _, label := range []string{"banana", "", "GO", "Go", " go"} {
		result := mapper.Map(label, confident)
		if result.Action != nil || result.Reason != ReasonUnknownLabel {
			t.Errorf("%q: reason = %q", label, result.Reason)
		}
	}
}

func TestMapOutputUsesThePrediction(t *testing.T) {
	mapper := loadTestMapper(t)
	prediction := ClassifierOutput{
		Label:       "left",
		Confidence:  0.91,
		TopK:        []TopKEntry{{Label: "left", Confidence: 0.91}},
		InferenceMs: 2.0,
	}
	result := mapper.MapOutput(prediction)
	if result.Action == nil || result.Action.Action != "switch_tab" ||
		result.Action.Params["direction"] != "left" {
		t.Fatalf("unexpected result: %+v", result)
	}

	prediction.Confidence = 0.5
	if mapper.MapOutput(prediction).Reason != ReasonBelowThreshold {
		t.Fatal("threshold was not applied")
	}
}

func TestReturnedActionsAreIndependentCopies(t *testing.T) {
	mapper := loadTestMapper(t)
	first := mapper.Map("left", confident)
	first.Action.Params["direction"] = "tampered"
	if got := mapper.Map("left", confident).Action.Params["direction"]; got != "left" {
		t.Fatalf("shared params were mutated: %q", got)
	}
}

func TestResultSerialisesToTheDocumentedShape(t *testing.T) {
	mapper := loadTestMapper(t)

	mapped, err := json.Marshal(mapper.Map("left", 0.9))
	if err != nil {
		t.Fatal(err)
	}
	wantMapped := `{"label":"left","confidence":0.9,"reason":"mapped","action":{"action":"switch_tab","params":{"direction":"left"}}}`
	if string(mapped) != wantMapped {
		t.Fatalf("mapped JSON = %s", mapped)
	}

	ignored, err := json.Marshal(mapper.Map("cat", 0.9))
	if err != nil {
		t.Fatal(err)
	}
	wantIgnored := `{"label":"cat","confidence":0.9,"reason":"no_action_word","action":null}`
	if string(ignored) != wantIgnored {
		t.Fatalf("ignored JSON = %s", ignored)
	}
}

func TestMalformedMapsAreRejected(t *testing.T) {
	t.Setenv(thresholdEnvVar, "")
	badMaps := []string{
		`{"commands": {"go": {"action": "x"}}, "no_action": ["go"]}`,
		`{"commands": {"go": {"action": "x"}}, "no_action": ["cat", "cat"]}`,
		`{"commands": {"go": {"action": ""}}, "no_action": []}`,
		`{"commands": {"go": {}}, "no_action": []}`,
		`{"confidence_threshold": 1.5, "commands": {}, "no_action": []}`,
		`{"confidence_threshold": -0.1, "commands": {}, "no_action": []}`,
		`{"confidence_threshold": 0.75, "no_action": []}`,
		`{"confidence_threshold": 0.75, "commands": {}}`,
	}
	for _, document := range badMaps {
		if _, err := NewCommandMapperFromJSON([]byte(document), nil); err == nil {
			t.Errorf("expected an error for %s", document)
		}
	}
}

func TestCommandMapPathCanComeFromTheEnvironment(t *testing.T) {
	t.Setenv(thresholdEnvVar, "")
	path := filepath.Join(t.TempDir(), "custom.json")
	document := `{"commands": {"go": {"action": "custom_action"}}, "no_action": ["cat"]}`
	if err := os.WriteFile(path, []byte(document), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv(commandMapEnvVar, path)

	mapper, err := LoadCommandMapper(nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := mapper.Map("go", confident).Action.Action; got != "custom_action" {
		t.Fatalf("action = %q", got)
	}
}

func TestMissingFileIsAnError(t *testing.T) {
	if _, err := NewCommandMapperFromFile(filepath.Join(t.TempDir(), "nope.json"), nil); err == nil {
		t.Fatal("expected an error")
	}
}
