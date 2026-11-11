package voice

import (
	"math"
)

// floatEpsilon mirrors numpy.finfo(float).eps, which python_speech_features
// substitutes for a frame whose total energy is exactly zero.
const floatEpsilon = 2.220446049250313e-16

// FeatureExtractor turns one utterance of mono float samples into the pooled
// 78-dimensional feature vector a Classifier expects. It reproduces
// python_speech_features.mfcc + delta + delta-delta followed by the repo's
// pool_features(); see the parameter block in params.go for the exact call.
//
// It is immutable after construction and safe for concurrent use.
type FeatureExtractor struct {
	window  []float64
	filters [][]float64 // NumFilters x (MFCCNFFT/2+1)
	dct     [][]float64 // NumCepstra x NumFilters
	lifter  []float64   // NumCepstra

	// radix-2 FFT tables for MFCCNFFT points.
	bitrev  []int
	twiddle []complex128
}

// NewFeatureExtractor builds the window, mel filterbank, DCT and lifter tables.
func NewFeatureExtractor() *FeatureExtractor {
	e := &FeatureExtractor{
		window:  hammingWindow(MFCCWindowSamples),
		filters: melFilterbank(),
		lifter:  lifterCoefficients(),
	}
	e.dct = dctMatrix(MFCCNumFilters, NumCepstra)
	e.bitrev, e.twiddle = fftTables(MFCCNFFT)
	return e
}

// ExtractSequence returns the raw (frames x 39) feature matrix in
// [c0..c12, d0..d12, dd0..dd12] channel order. Like the Python pipeline it may
// contain NaN or infinities (e.g. a digitally silent frame); Pool applies the
// same nan_to_num step as models.py.
func (e *FeatureExtractor) ExtractSequence(samples []float32) [][]float64 {
	signal := make([]float64, len(samples))
	for i, s := range samples {
		signal[i] = float64(s)
	}
	signal = preEmphasize(signal, MFCCPreEmphasis)

	frames := frameSignal(signal, MFCCWindowSamples, FrameHop)
	if len(frames) == 0 {
		return nil
	}

	mfccs := make([][]float64, len(frames))
	for i, frame := range frames {
		mfccs[i] = e.mfccFrame(frame)
	}
	delta := deltas(mfccs, DeltaWidth)
	deltaDelta := deltas(delta, DeltaWidth)

	sequence := make([][]float64, len(mfccs))
	for i := range mfccs {
		row := make([]float64, 0, NumFeatureChannels)
		row = append(row, mfccs[i]...)
		row = append(row, delta[i]...)
		row = append(row, deltaDelta[i]...)
		sequence[i] = row
	}
	return sequence
}

// ExtractFeatures returns the pooled feature vector: the mean of each of the 39
// channels followed by its standard deviation (ddof = 0). This is exactly
// pool_features() in models.py and the input the classifier contract expects.
func (e *FeatureExtractor) ExtractFeatures(samples []float32) []float32 {
	return poolFeatures(e.ExtractSequence(samples))
}

// mfccFrame computes the 13 cepstra of one windowed frame.
func (e *FeatureExtractor) mfccFrame(frame []float64) []float64 {
	power := e.powerSpectrum(frame)

	var energy float64
	for _, p := range power {
		energy += p
	}
	if energy == 0 {
		energy = floatEpsilon
	}

	mel := make([]float64, len(e.filters))
	for j, filter := range e.filters {
		var sum float64
		for k, weight := range filter {
			sum += power[k] * weight
		}
		if sum == 0 {
			// python_speech_features floors a zero filterbank energy at eps
			// before the log, so digital silence yields log(eps), not -Inf.
			sum = floatEpsilon
		}
		mel[j] = math.Log(sum)
	}

	cepstra := make([]float64, NumCepstra)
	for k := range cepstra {
		var sum float64
		for j := range mel {
			sum += e.dct[k][j] * mel[j]
		}
		cepstra[k] = sum * e.lifter[k]
	}
	if MFCCAppendEnergy {
		cepstra[0] = math.Log(energy)
	}
	return cepstra
}

// powerSpectrum returns |rfft(windowed frame)|^2 / NFFT for bins 0..NFFT/2.
func (e *FeatureExtractor) powerSpectrum(frame []float64) []float64 {
	n := MFCCNFFT
	buf := make([]complex128, n)
	for i := 0; i < len(frame) && i < n; i++ {
		buf[e.bitrev[i]] = complex(frame[i]*e.window[i], 0)
	}

	for size := 2; size <= n; size <<= 1 {
		half := size >> 1
		step := n / size
		for start := 0; start < n; start += size {
			for k := 0; k < half; k++ {
				t := e.twiddle[k*step] * buf[start+k+half]
				u := buf[start+k]
				buf[start+k] = u + t
				buf[start+k+half] = u - t
			}
		}
	}

	power := make([]float64, n/2+1)
	scale := 1.0 / float64(n)
	for k := range power {
		re, im := real(buf[k]), imag(buf[k])
		power[k] = (re*re + im*im) * scale
	}
	return power
}

// frameSignal slices signal into overlapping frames, zero-padding the final
// partial frame exactly like python_speech_features.framesig. A signal shorter
// than one frame yields a single zero-padded frame.
func frameSignal(signal []float64, frameLen, frameStep int) [][]float64 {
	if len(signal) == 0 {
		return nil
	}
	numFrames := 1
	if len(signal) > frameLen {
		numFrames = 1 + int(math.Ceil(float64(len(signal)-frameLen)/float64(frameStep)))
	}

	frames := make([][]float64, numFrames)
	for f := 0; f < numFrames; f++ {
		frame := make([]float64, frameLen)
		start := f * frameStep
		for i := 0; i < frameLen; i++ {
			if idx := start + i; idx < len(signal) {
				frame[i] = signal[idx]
			}
		}
		frames[f] = frame
	}
	return frames
}

// preEmphasize is s[0], s[1]-a*s[0], s[2]-a*s[1], ... like
// python_speech_features.sigproc.preemphasis.
func preEmphasize(signal []float64, coeff float64) []float64 {
	out := make([]float64, len(signal))
	if len(signal) == 0 {
		return out
	}
	out[0] = signal[0]
	for i := 1; i < len(signal); i++ {
		out[i] = signal[i] - coeff*signal[i-1]
	}
	return out
}

// deltas mirrors python_speech_features.delta: the regression over the N frames
// on each side, with edge replication at the boundaries.
func deltas(features [][]float64, n int) [][]float64 {
	frames := len(features)
	if frames == 0 {
		return nil
	}
	dim := len(features[0])

	denominator := 0.0
	for i := 1; i <= n; i++ {
		denominator += 2 * float64(i*i)
	}

	padded := make([][]float64, 0, frames+2*n)
	for i := 0; i < n; i++ {
		padded = append(padded, features[0])
	}
	padded = append(padded, features...)
	for i := 0; i < n; i++ {
		padded = append(padded, features[frames-1])
	}

	out := make([][]float64, frames)
	for t := 0; t < frames; t++ {
		row := make([]float64, dim)
		for k := -n; k <= n; k++ {
			frame := padded[t+n+k]
			weight := float64(k)
			for d := 0; d < dim; d++ {
				row[d] += weight * frame[d]
			}
		}
		for d := 0; d < dim; d++ {
			row[d] /= denominator
		}
		out[t] = row
	}
	return out
}

// poolFeatures computes mean and standard deviation per channel, converting
// non-finite values to zero first (nan_to_num with nan/posinf/neginf = 0), and
// returns float32 like models.py.
func poolFeatures(sequence [][]float64) []float32 {
	if len(sequence) == 0 {
		out := make([]float32, FeatureDim)
		return out
	}

	frames := len(sequence)
	pooled := make([]float32, FeatureDim)
	means := make([]float64, NumFeatureChannels)

	for channel := 0; channel < NumFeatureChannels; channel++ {
		var sum float64
		for _, row := range sequence {
			sum += sanitize(row[channel])
		}
		means[channel] = sum / float64(frames)
		pooled[channel] = float32(means[channel])
	}

	for channel := 0; channel < NumFeatureChannels; channel++ {
		var sumSquares float64
		for _, row := range sequence {
			d := sanitize(row[channel]) - means[channel]
			sumSquares += d * d
		}
		pooled[NumFeatureChannels+channel] = float32(math.Sqrt(sumSquares / float64(frames)))
	}
	return pooled
}

func sanitize(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return v
}

// hammingWindow is numpy.hamming(n): 0.54 - 0.46*cos(2*pi*i/(n-1)).
func hammingWindow(n int) []float64 {
	window := make([]float64, n)
	for i := range window {
		window[i] = 0.54 - 0.46*math.Cos(2*math.Pi*float64(i)/float64(n-1))
	}
	return window
}

// melFilterbank reproduces python_speech_features.get_filterbanks defaults.
func melFilterbank() [][]float64 {
	numBins := MFCCNFFT/2 + 1
	lowMel := hzToMel(0)
	highMel := hzToMel(MFCCHighFreqHz)

	points := make([]float64, MFCCNumFilters+2)
	for i := range points {
		points[i] = lowMel + (highMel-lowMel)*float64(i)/float64(len(points)-1)
	}

	bins := make([]int, len(points))
	for i, mel := range points {
		bins[i] = int(math.Floor(float64(MFCCNFFT+1) * melToHz(mel) / float64(SampleRate)))
	}

	filters := make([][]float64, MFCCNumFilters)
	for j := 0; j < MFCCNumFilters; j++ {
		filter := make([]float64, numBins)
		left, centre, right := bins[j], bins[j+1], bins[j+2]
		if centre > left {
			for i := left; i < centre && i < numBins; i++ {
				filter[i] = float64(i-left) / float64(centre-left)
			}
		}
		if right > centre {
			for i := centre; i < right && i < numBins; i++ {
				filter[i] = float64(right-i) / float64(right-centre)
			}
		}
		filters[j] = filter
	}
	return filters
}

func hzToMel(hz float64) float64 {
	return 2595 * math.Log10(1+hz/700)
}

func melToHz(mel float64) float64 {
	return 700 * (math.Pow(10, mel/2595) - 1)
}

// dctMatrix is scipy.fftpack.dct(type=2, norm="ortho") restricted to the first
// numOut coefficients: rows are the orthonormal DCT-II basis vectors.
func dctMatrix(numIn, numOut int) [][]float64 {
	matrix := make([][]float64, numOut)
	for k := 0; k < numOut; k++ {
		row := make([]float64, numIn)
		scale := math.Sqrt(2.0 / float64(numIn))
		if k == 0 {
			scale = math.Sqrt(1.0 / float64(numIn))
		}
		for n := 0; n < numIn; n++ {
			row[n] = scale * math.Cos(math.Pi*float64(k)*float64(2*n+1)/float64(2*numIn))
		}
		matrix[k] = row
	}
	return matrix
}

// lifterCoefficients is python_speech_features.lifter with L = MFCCLifter.
func lifterCoefficients() []float64 {
	coeffs := make([]float64, NumCepstra)
	if MFCCLifter <= 0 {
		for i := range coeffs {
			coeffs[i] = 1
		}
		return coeffs
	}
	for n := range coeffs {
		coeffs[n] = 1 + float64(MFCCLifter)/2*math.Sin(math.Pi*float64(n)/float64(MFCCLifter))
	}
	return coeffs
}

// fftTables returns the bit-reversal permutation and the e^(-2*pi*i*k/n)
// twiddles for a radix-2 FFT of size n.
func fftTables(n int) ([]int, []complex128) {
	bitrev := make([]int, n)
	bits := 0
	for 1<<bits < n {
		bits++
	}
	for i := 0; i < n; i++ {
		rev := 0
		for b := 0; b < bits; b++ {
			if i&(1<<b) != 0 {
				rev |= 1 << (bits - 1 - b)
			}
		}
		bitrev[i] = rev
	}

	twiddle := make([]complex128, n/2)
	for k := range twiddle {
		angle := -2 * math.Pi * float64(k) / float64(n)
		twiddle[k] = complex(math.Cos(angle), math.Sin(angle))
	}
	return bitrev, twiddle
}
