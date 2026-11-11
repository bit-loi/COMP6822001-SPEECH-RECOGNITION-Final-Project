package voice

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// The mapper mirrors backend-python/services/command_mapper.py and reads the
// very same command_map.json, which is the single source of truth for the
// keyword -> editor action table.

const (
	// DefaultConfidenceThreshold is used when neither the caller, the
	// environment nor the map file sets one.
	DefaultConfidenceThreshold = 0.75

	thresholdEnvVar  = "AMBATUCODE_CONFIDENCE_THRESHOLD"
	commandMapEnvVar = "AMBATUCODE_COMMAND_MAP"

	// defaultMapRelativePath is resolved from the process or executable
	// directory by walking up towards the repository root.
	defaultMapRelativePath = "backend-python/services/command_map.json"
)

// MapReason says why a prediction did or did not produce an action.
type MapReason string

const (
	// ReasonMapped: the label is a command and the confidence passed.
	ReasonMapped MapReason = "mapped"
	// ReasonBelowThreshold: a command word, but not confidently recognised.
	ReasonBelowThreshold MapReason = "below_threshold"
	// ReasonNoActionWord: a known word that intentionally maps to nothing.
	ReasonNoActionWord MapReason = "no_action_word"
	// ReasonUnknownLabel: the label is not in the map at all.
	ReasonUnknownLabel MapReason = "unknown_label"
)

// CommandAction is an action the frontend should perform, e.g. switch_tab with
// a direction parameter.
type CommandAction struct {
	Action string            `json:"action"`
	Params map[string]string `json:"params"`
}

// MapResult is the outcome of mapping one prediction. Action is nil unless
// Reason is ReasonMapped.
type MapResult struct {
	Label      string         `json:"label"`
	Confidence float64        `json:"confidence"`
	Reason     MapReason      `json:"reason"`
	Action     *CommandAction `json:"action"`
}

// CommandSpec is one label's entry in the command map.
type CommandSpec struct {
	Action string            `json:"action"`
	Params map[string]string `json:"params"`
}

// CommandMapConfig is the parsed command_map.json. ConfidenceThreshold is a
// pointer so that an explicit 0 is distinguishable from a missing field.
type CommandMapConfig struct {
	Version             int                    `json:"version"`
	ConfidenceThreshold *float64               `json:"confidence_threshold"`
	Commands            map[string]CommandSpec `json:"commands"`
	NoAction            []string               `json:"no_action"`
}

// CommandMapper looks up the editor action for a (label, confidence) prediction.
// It is immutable after construction and safe for concurrent use.
type CommandMapper struct {
	threshold float64
	commands  map[string]CommandAction
	noAction  map[string]struct{}
}

// NewCommandMapper validates config and resolves the confidence threshold in
// this order: explicitThreshold, then AMBATUCODE_CONFIDENCE_THRESHOLD, then the
// map file's confidence_threshold, then DefaultConfidenceThreshold.
func NewCommandMapper(config CommandMapConfig, explicitThreshold *float64) (*CommandMapper, error) {
	if config.Commands == nil {
		return nil, errors.New("commands is required")
	}
	if config.NoAction == nil {
		return nil, errors.New("no_action is required")
	}

	threshold := DefaultConfidenceThreshold
	if config.ConfidenceThreshold != nil {
		threshold = *config.ConfidenceThreshold
	}
	if err := validateThreshold(threshold, "the map file"); err != nil {
		return nil, err
	}

	if explicitThreshold != nil {
		threshold = *explicitThreshold
		if err := validateThreshold(threshold, "the constructor argument"); err != nil {
			return nil, err
		}
	} else if raw, ok := os.LookupEnv(thresholdEnvVar); ok && strings.TrimSpace(raw) != "" {
		parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
		if err != nil {
			return nil, fmt.Errorf("%s must be a number, got %q", thresholdEnvVar, raw)
		}
		threshold = parsed
		if err := validateThreshold(threshold, thresholdEnvVar); err != nil {
			return nil, err
		}
	}

	commands := make(map[string]CommandAction, len(config.Commands))
	for label, spec := range config.Commands {
		if spec.Action == "" {
			return nil, fmt.Errorf("command %q has an empty action", label)
		}
		params := make(map[string]string, len(spec.Params))
		for key, value := range spec.Params {
			params[key] = value
		}
		commands[label] = CommandAction{Action: spec.Action, Params: params}
	}

	noAction := make(map[string]struct{}, len(config.NoAction))
	for _, label := range config.NoAction {
		if _, dup := noAction[label]; dup {
			return nil, fmt.Errorf("duplicate label in no_action: %q", label)
		}
		noAction[label] = struct{}{}
	}

	for label := range commands {
		if _, both := noAction[label]; both {
			return nil, fmt.Errorf("label %q is listed as both command and no_action", label)
		}
	}

	return &CommandMapper{threshold: threshold, commands: commands, noAction: noAction}, nil
}

func validateThreshold(value float64, source string) error {
	if value < 0 || value > 1 {
		return fmt.Errorf("confidence threshold from %s must be within [0, 1], got %v", source, value)
	}
	return nil
}

// NewCommandMapperFromJSON parses and validates a map document.
func NewCommandMapperFromJSON(data []byte, explicitThreshold *float64) (*CommandMapper, error) {
	var config CommandMapConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse command map: %w", err)
	}
	return NewCommandMapper(config, explicitThreshold)
}

// NewCommandMapperFromFile loads a map from path.
func NewCommandMapperFromFile(path string, explicitThreshold *float64) (*CommandMapper, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return NewCommandMapperFromJSON(data, explicitThreshold)
}

// LoadCommandMapper loads $AMBATUCODE_COMMAND_MAP, else finds
// backend-python/services/command_map.json by walking up from the working
// directory and the executable directory.
func LoadCommandMapper(explicitThreshold *float64) (*CommandMapper, error) {
	path, err := resolveCommandMapPath()
	if err != nil {
		return nil, err
	}
	return NewCommandMapperFromFile(path, explicitThreshold)
}

func resolveCommandMapPath() (string, error) {
	if path := os.Getenv(commandMapEnvVar); path != "" {
		return path, nil
	}

	var starts []string
	if wd, err := os.Getwd(); err == nil {
		starts = append(starts, wd)
	}
	if exe, err := os.Executable(); err == nil {
		starts = append(starts, filepath.Dir(exe))
	}

	for _, start := range starts {
		for dir := start; ; dir = filepath.Dir(dir) {
			candidate := filepath.Join(dir, filepath.FromSlash(defaultMapRelativePath))
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				return candidate, nil
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
		}
	}
	return "", fmt.Errorf("command map not found; set %s", commandMapEnvVar)
}

// ConfidenceThreshold returns the threshold this mapper resolved.
func (m *CommandMapper) ConfidenceThreshold() float64 { return m.threshold }

// Labels returns every label the mapper knows, sorted, which matches the
// classifier's class order.
func (m *CommandMapper) Labels() []string {
	labels := make([]string, 0, len(m.commands)+len(m.noAction))
	for label := range m.commands {
		labels = append(labels, label)
	}
	for label := range m.noAction {
		labels = append(labels, label)
	}
	sort.Strings(labels)
	return labels
}

// Map applies the decision order: no_action word, unknown label, below
// threshold, mapped. The threshold comparison is inclusive.
func (m *CommandMapper) Map(label string, confidence float64) MapResult {
	if _, ok := m.noAction[label]; ok {
		return MapResult{Label: label, Confidence: confidence, Reason: ReasonNoActionWord}
	}

	command, ok := m.commands[label]
	if !ok {
		return MapResult{Label: label, Confidence: confidence, Reason: ReasonUnknownLabel}
	}

	if confidence < m.threshold {
		return MapResult{Label: label, Confidence: confidence, Reason: ReasonBelowThreshold}
	}

	params := make(map[string]string, len(command.Params))
	for key, value := range command.Params {
		params[key] = value
	}
	return MapResult{
		Label:      label,
		Confidence: confidence,
		Reason:     ReasonMapped,
		Action:     &CommandAction{Action: command.Action, Params: params},
	}
}

// MapOutput maps a classifier prediction.
func (m *CommandMapper) MapOutput(output ClassifierOutput) MapResult {
	return m.Map(output.Label, output.Confidence)
}
