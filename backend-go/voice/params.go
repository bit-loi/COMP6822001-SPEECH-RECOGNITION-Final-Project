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
// Audio on the wire
// ---------------------------------------------------------------------------

const (
	// SampleRate is the rate (Hz) of the mono PCM stream clients must send.
	SampleRate = 16000

	// BytesPerSample: the wire format is signed 16-bit little-endian PCM.
	BytesPerSample = 2

	// SampleScale converts one int16 sample to the amplitude the feature
	// extractor sees (full scale = +-1.0). This is part of the training
	// contract: the MFCC c0 coefficient (log energy) shifts by a constant if the
	// training pipeline used raw int16 values instead.
	SampleScale = 1.0 / 32768.0

	// Clients should send chunks of ChunkMsMin..ChunkMsMax milliseconds. The
	// server re-frames internally, so any chunk length works, but messages
	// larger than MaxMessageBytes (2 s of audio) are rejected.
	ChunkMsMin      = 200
	ChunkMsMax      = 300
	MaxMessageBytes = 2 * SampleRate * BytesPerSample
)

// ---------------------------------------------------------------------------
// Framing (shared by the VAD and the MFCC front end)
// ---------------------------------------------------------------------------

const (
	// FrameHopMs is the analysis hop: the VAD takes one decision per hop and
	// MFCC frames start every hop. 10 ms = 160 samples at 16 kHz.
	FrameHopMs = 10
	FrameHop   = SampleRate * FrameHopMs / 1000
)

// ---------------------------------------------------------------------------
// Voice activity detection (energy based, no learned component)
//
// Every duration is a whole number of FrameHopMs hops. A "frame level" is the
// mean-removed RMS of one hop in dBFS.
// ---------------------------------------------------------------------------

const (
	// EnergyFloorDB is the level reported for digital silence.
	EnergyFloorDB = -100.0

	// VADStartMarginDB: a frame is "loud" when its level exceeds the tracked
	// noise floor by more than this.
	VADStartMarginDB = 12.0

	// VADEndMarginDB: while in speech, a frame still counts as speech when it
	// exceeds the noise floor by more than this. It is lower than the start
	// margin on purpose (hysteresis) so decaying word endings are not clipped.
	VADEndMarginDB = 6.0

	// VADMinLevelDB is an absolute floor: nothing quieter than this is ever
	// speech, however low the noise floor drops.
	VADMinLevelDB = -45.0

	// VADInitialNoiseDB is the noise-floor estimate before any audio is seen.
	VADInitialNoiseDB = -60.0

	// Per-frame smoothing of the noise-floor estimate, applied to quiet frames
	// only (speech never raises the floor). It falls fast and rises slowly.
	VADNoiseFallRate = 0.10
	VADNoiseRiseRate = 0.01

	// VADStartFrames is how many consecutive loud frames start an utterance.
	VADStartFrames = 3

	// VADHangoverMs of continuous quiet ends an utterance. It also bridges the
	// short gaps inside a word, and is the dominant part of the delay between
	// the speaker stopping and an action firing.
	VADHangoverMs     = 300
	VADHangoverFrames = VADHangoverMs / FrameHopMs

	// VADMinSpeechMs: an utterance whose first-to-last loud frame span is
	// shorter than this (a click or a cough) is discarded, not classified.
	VADMinSpeechMs     = 100
	VADMinSpeechFrames = VADMinSpeechMs / FrameHopMs

	// VADMaxUtteranceMs force-ends an utterance that never goes quiet (a fan, a
	// long monologue). After a forced end the VAD stays disarmed until it has
	// seen VADHangoverMs of quiet, so a steady noise cannot re-trigger it.
	VADMaxUtteranceMs     = 2000
	VADMaxUtteranceFrames = VADMaxUtteranceMs / FrameHopMs

	// PreRollMs of audio before the detected onset and TailMs after the last
	// loud frame are kept for feature extraction, so the pooled statistics see a
	// little context on both sides of the word.
	PreRollMs     = 100
	PreRollFrames = PreRollMs / FrameHopMs
	TailMs        = 100
	TailFrames    = TailMs / FrameHopMs
)

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
