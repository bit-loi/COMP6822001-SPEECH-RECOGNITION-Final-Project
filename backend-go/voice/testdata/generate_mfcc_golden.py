"""Regenerates mfcc_golden.json, the reference vectors for mfcc_test.go.

Run with python_speech_features 0.6.1 installed (it is pure Python):

    python generate_mfcc_golden.py > mfcc_golden.json

The Go extractor must reproduce the same values. The signals are LCG-generated
integers so both languages build identical sample arrays; samples are int16
values divided by 32768, exactly what the WebSocket handler produces.
"""

import json

import numpy as np
from python_speech_features import delta, mfcc

WINDOW = np.hamming


def lcg_signal(n, seed, span=65536, offset=32768):
    state = seed
    out = np.empty(n, dtype=np.int64)
    for i in range(n):
        state = (state * 1103515245 + 12345) % 2147483648
        out[i] = (state % span) - offset
    return out.astype(np.int16)


def pool(sequence):
    sequence = np.asarray(sequence, dtype=np.float32)
    sequence = np.nan_to_num(sequence, nan=0.0, posinf=0.0, neginf=0.0)
    return np.concatenate([np.mean(sequence, axis=0), np.std(sequence, axis=0)])


def features(samples):
    signal = samples.astype(np.float64) / 32768.0
    static = mfcc(
        signal,
        samplerate=16000,
        winlen=0.025,
        winstep=0.01,
        numcep=13,
        nfilt=26,
        nfft=512,
        lowfreq=0,
        highfreq=8000,
        preemph=0.97,
        ceplifter=22,
        appendEnergy=True,
        winfunc=WINDOW,
    )
    d1 = delta(static, 2)
    d2 = delta(d1, 2)
    stacked = np.concatenate([static, d1, d2], axis=1)
    return stacked, pool(stacked)


CASES = {
    "noise": lcg_signal(8000, 123456789, 65536, 32768),
    "quiet": lcg_signal(6000, 987654321, 2000, 1000),
    "short": lcg_signal(401, 42, 65536, 32768),
    "one_frame": lcg_signal(400, 7, 65536, 32768),
    "digital_silence": np.zeros(800, dtype=np.int16),
}

result = {}
for name, samples in CASES.items():
    stacked, pooled = features(samples)
    result[name] = {
        "frames": int(stacked.shape[0]),
        "first_frame": [float(x) for x in stacked[0]],
        "pooled": [float(x) for x in pooled],
    }

print(json.dumps(result, indent=2))
