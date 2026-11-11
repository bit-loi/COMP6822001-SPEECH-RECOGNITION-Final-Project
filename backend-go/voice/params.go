// Package voice is AmbatuCode's local, classical (non-deep-learning) keyword
// recognition pipeline: PCM chunks -> energy VAD -> MFCC + deltas -> classifier
// -> command mapper -> editor action. It uses no cloud API.
//
// params.go is the ONE place where every tunable of that pipeline lives. The
// feature-extraction constants must match whatever produces the training
// features on the Python side; see MIGRATION_NOTES.md for the exact
// python_speech_features call that reproduces them.
package voice

// ---------------------------------------------------------------------------
// MFCC feature layout
// ---------------------------------------------------------------------------

const (
	// NumCepstra is the number of MFCC coefficients kept per frame (c0..c12).
	NumCepstra = 13

	// NumFeatureChannels is static MFCC + delta + delta-delta, stacked in that
	// order: [c0..c12, d0..d12, dd0..dd12].
	NumFeatureChannels = 3 * NumCepstra

	// FeatureDim is the length of the pooled utterance vector handed to the
	// classifier: the mean of every channel followed by the standard deviation
	// (ddof = 0) of every channel. This is exactly pool_features() in the repo's
	// models.py, so the existing scikit-learn models consume it unchanged.
	FeatureDim = 2 * NumFeatureChannels
)

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const (
	// TopK is how many ranked candidates a classifier returns.
	TopK = 3
)

// labels are the 37 classes of Google Speech Commands v2 (35 keywords plus
// "silence" and "unknown"), in alphabetical order. That is the class order
// sorted(np.unique(y)) gives in models.py, hence the output order of a model
// trained that way. It must match SPEECH_COMMANDS_LABELS in
// backend-python/services/classifier.py and the classes in command_map.json.
var labels = [...]string{
	"backward", "bed", "bird", "cat", "dog", "down", "eight", "five", "follow",
	"forward", "four", "go", "happy", "house", "learn", "left", "marvin", "nine",
	"no", "off", "on", "one", "right", "seven", "sheila", "silence", "six", "stop",
	"three", "tree", "two", "unknown", "up", "visual", "wow", "yes", "zero",
}

// Labels returns a copy of the class labels in model output order.
func Labels() []string {
	return append([]string(nil), labels[:]...)
}
