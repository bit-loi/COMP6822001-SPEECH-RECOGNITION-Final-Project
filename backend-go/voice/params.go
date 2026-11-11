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
// MFCC front end
//
// These reproduce the Python training call with python_speech_features, which is
// the reference implementation (see mfcc.go):
//
//	numpy.hamming window, 25 ms / 10 ms, 26 mel filters over 0..8000 Hz,
//	512-point FFT, pre-emphasis 0.97, cepstral lifter 22, c0 replaced by the
//	frame log energy, then delta and delta-delta with N = 2.
//
//	features = mfcc(signal, samplerate=16000, winlen=0.025, winstep=0.01,
//	                numcep=13, nfilt=26, nfft=512, lowfreq=0, highfreq=8000,
//	                preemph=0.97, ceplifter=22, appendEnergy=True,
//	                winfunc=numpy.hamming)
//	delta    = mfcc_delta(psf.delta(features, 2), 2)
//	stacked  = numpy.concatenate([features, delta, delta_delta], axis=1)
//
// Changing any of these without retraining breaks the classifier.
// ---------------------------------------------------------------------------

const (
	// MFCCWindowMs / MFCCWindowSamples: analysis window length.
	MFCCWindowMs      = 25
	MFCCWindowSamples = SampleRate * MFCCWindowMs / 1000

	// MFCCNumFilters is the number of triangular mel filters.
	MFCCNumFilters = 26

	// MFCCNFFT is the FFT size; frames shorter than it are zero-padded.
	MFCCNFFT = 512

	// MFCCHighFreqHz is the upper mel-filter edge (the Nyquist frequency).
	MFCCHighFreqHz = SampleRate / 2

	// MFCCPreEmphasis is the pre-emphasis coefficient (0 disables it).
	MFCCPreEmphasis = 0.97

	// MFCCLifter is the cepstral lifter coefficient (<= 0 disables it).
	MFCCLifter = 22

	// MFCCAppendEnergy replaces c0 with the log of the frame energy, exactly as
	// python_speech_features does with appendEnergy=True.
	MFCCAppendEnergy = true

	// DeltaWidth N: delta/delta-delta use the N frames on each side.
	DeltaWidth = 2
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
