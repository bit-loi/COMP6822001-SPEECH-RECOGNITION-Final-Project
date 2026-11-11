package voice

import "math"

// VADKind says what a VAD decision means.
type VADKind int

const (
	// VADNone: nothing happened on this frame.
	VADNone VADKind = iota
	// VADSpeechStart: an utterance began.
	VADSpeechStart
	// VADSpeechEnd: an utterance ended (or was discarded as too short).
	VADSpeechEnd
)

// EndReason says why an utterance ended.
type EndReason string

const (
	// EndSilence: VADHangoverMs of quiet followed the last loud frame.
	EndSilence EndReason = "silence"
	// EndMaxLength: the utterance hit VADMaxUtteranceMs without going quiet.
	EndMaxLength EndReason = "max_length"
	// EndFlush: the caller ended it (e.g. the user stopped recording).
	EndFlush EndReason = "flush"
)

// VADEvent is the result of feeding one frame to the VAD. All counts are in
// frames of FrameHopMs.
type VADEvent struct {
	Kind VADKind

	// Lookback (VADSpeechStart): how many frames BEFORE the current one belong
	// to the onset, i.e. the loud frames that had to be seen before the start
	// could be declared. The utterance begins Lookback frames ago.
	Lookback int

	// SpeechFrames (VADSpeechEnd): frames from the onset to the last loud frame,
	// inclusive.
	SpeechFrames int
	// SilentTail (VADSpeechEnd): quiet frames after the last loud frame at the
	// moment of the decision.
	SilentTail int
	// TotalFrames (VADSpeechEnd): frames from the onset to this decision,
	// inclusive.
	TotalFrames int
	// Reason (VADSpeechEnd) says why the utterance ended.
	Reason EndReason
	// Discarded (VADSpeechEnd): the utterance was shorter than
	// VADMinSpeechFrames and must not be classified.
	Discarded bool
}

type vadState int

const (
	vadIdle     vadState = iota // listening for an onset
	vadSpeech                   // inside an utterance
	vadDisarmed                 // after a forced end: wait for quiet before listening again
)

// VAD is a streaming, energy-based voice activity detector. Feed it
// consecutive FrameHop-sample frames; it reports utterance starts and ends. It
// is not safe for concurrent use.
//
// The speech threshold adapts: it is the tracked noise floor plus a margin,
// never below VADMinLevelDB. The floor follows quiet frames only (fast down,
// slow up) and is frozen while speech is in progress.
type VAD struct {
	state   vadState
	noiseDB float64

	loudRun  int // consecutive loud frames while idle
	quietRun int // consecutive quiet frames while disarmed

	total    int // frames since the onset, inclusive (speech state)
	lastLoud int // frame index, relative to the onset, of the last loud frame
}

// NewVAD returns a VAD in its initial state.
func NewVAD() *VAD {
	v := &VAD{}
	v.Reset()
	return v
}

// Reset returns the VAD to its initial state, forgetting the noise floor.
func (v *VAD) Reset() {
	*v = VAD{noiseDB: VADInitialNoiseDB}
}

// InSpeech reports whether an utterance is in progress.
func (v *VAD) InSpeech() bool { return v.state == vadSpeech }

// NoiseFloorDB returns the current noise-floor estimate in dBFS.
func (v *VAD) NoiseFloorDB() float64 { return v.noiseDB }

// FrameLevelDB is the mean-removed RMS level of a frame in dBFS, floored at
// EnergyFloorDB. Removing the mean makes a constant DC offset, which some
// microphones have, invisible to the detector.
func FrameLevelDB(frame []float32) float64 {
	n := len(frame)
	if n == 0 {
		return EnergyFloorDB
	}
	var sum, sumSq float64
	for _, s := range frame {
		x := float64(s)
		sum += x
		sumSq += x * x
	}
	mean := sum / float64(n)
	variance := sumSq/float64(n) - mean*mean
	if variance <= 0 {
		return EnergyFloorDB
	}
	return math.Max(10*math.Log10(variance), EnergyFloorDB)
}

// Process consumes one frame and returns the decision it caused, if any.
func (v *VAD) Process(frame []float32) VADEvent {
	level := FrameLevelDB(frame)
	switch v.state {
	case vadSpeech:
		return v.inSpeech(level)
	case vadDisarmed:
		return v.disarmed(level)
	default:
		return v.idle(level)
	}
}

// Flush ends an utterance in progress right now (reason EndFlush). It returns
// VADNone when no utterance is in progress.
func (v *VAD) Flush() VADEvent {
	if v.state != vadSpeech {
		return VADEvent{}
	}
	return v.finish(EndFlush)
}

func (v *VAD) startThreshold() float64 {
	return math.Max(v.noiseDB+VADStartMarginDB, VADMinLevelDB)
}

func (v *VAD) endThreshold() float64 {
	return math.Max(v.noiseDB+VADEndMarginDB, VADMinLevelDB)
}

func (v *VAD) idle(level float64) VADEvent {
	if level > v.startThreshold() {
		v.loudRun++
		if v.loudRun < VADStartFrames {
			return VADEvent{}
		}
		v.state = vadSpeech
		v.total = v.loudRun
		v.lastLoud = v.total - 1
		v.loudRun = 0
		return VADEvent{Kind: VADSpeechStart, Lookback: v.total - 1}
	}
	v.loudRun = 0
	v.trackNoise(level)
	return VADEvent{}
}

func (v *VAD) inSpeech(level float64) VADEvent {
	v.total++
	if level > v.endThreshold() {
		v.lastLoud = v.total - 1
	}
	switch silentTail := v.total - 1 - v.lastLoud; {
	case silentTail >= VADHangoverFrames:
		return v.finish(EndSilence)
	case v.total >= VADMaxUtteranceFrames:
		return v.finish(EndMaxLength)
	}
	return VADEvent{}
}

func (v *VAD) disarmed(level float64) VADEvent {
	if level > v.endThreshold() {
		v.quietRun = 0
		return VADEvent{}
	}
	v.trackNoise(level)
	v.quietRun++
	if v.quietRun >= VADHangoverFrames {
		v.state = vadIdle
		v.quietRun = 0
	}
	return VADEvent{}
}

func (v *VAD) finish(reason EndReason) VADEvent {
	speechFrames := v.lastLoud + 1
	event := VADEvent{
		Kind:         VADSpeechEnd,
		SpeechFrames: speechFrames,
		SilentTail:   v.total - 1 - v.lastLoud,
		TotalFrames:  v.total,
		Reason:       reason,
		Discarded:    speechFrames < VADMinSpeechFrames,
	}

	v.total, v.lastLoud, v.loudRun, v.quietRun = 0, 0, 0, 0
	if reason == EndMaxLength {
		v.state = vadDisarmed
	} else {
		v.state = vadIdle
	}
	return event
}

// trackNoise moves the noise-floor estimate toward a quiet frame's level.
func (v *VAD) trackNoise(level float64) {
	rate := VADNoiseRiseRate
	if level < v.noiseDB {
		rate = VADNoiseFallRate
	}
	v.noiseDB += rate * (level - v.noiseDB)
}
