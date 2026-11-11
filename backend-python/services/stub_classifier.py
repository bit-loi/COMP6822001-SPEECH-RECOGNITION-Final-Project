"""Deterministic fake classifier for end-to-end testing.

``StubClassifier`` satisfies the ``Classifier`` protocol without any trained
model, so the whole voice pipeline (audio -> features -> classifier -> command
mapper -> editor action) can be exercised before the real model exists.

Two behaviours, both fully deterministic:

* **Hash mode** (default): the prediction is a pure function of the feature
  vector. The same features always give the same label, confidence and top-k;
  different features spread over the whole label set. Handy for demos: it
  exercises mapped commands, no-action words and below-threshold results.
* **Script mode** (``script=[...]``): labels are returned in order, cycling, with
  a fixed confidence. Use it to trigger one specific editor action on demand.

The algorithm uses integer arithmetic only and is mirrored line-for-line by
``backend-go/voice/stub.go``; both test suites pin the same golden vector, so the
two stubs agree bit-for-bit.

This is NOT a speech recogniser. Its output says nothing about the audio.
"""

import hashlib
import math
import struct
import threading
from typing import List, Optional, Sequence

from models.classifier_schemas import ClassifierOutput, TopKEntry
from services.classifier import FEATURE_DIM, SPEECH_COMMANDS_LABELS, FeatureVector

STUB_INFERENCE_MS = 0.5
DEFAULT_TOP_K = 3
MAX_TOP_K = 10
DEFAULT_SCRIPT_CONFIDENCE = 0.90

# Hash mode confidences land in [HASH_CONFIDENCE_MIN, HASH_CONFIDENCE_MAX] / 10000.
_HASH_CONFIDENCE_MIN = 5000
_HASH_CONFIDENCE_SPAN = 4900
_SCALE = 10000


class StubClassifier:
    def __init__(
        self,
        labels: Sequence[str] = SPEECH_COMMANDS_LABELS,
        feature_dim: int = FEATURE_DIM,
        top_k: int = DEFAULT_TOP_K,
        script: Optional[Sequence[str]] = None,
        scripted_confidence: float = DEFAULT_SCRIPT_CONFIDENCE,
    ):
        label_list = list(labels)
        if not label_list:
            raise ValueError("labels must not be empty")
        if len(set(label_list)) != len(label_list):
            raise ValueError("labels must be unique")
        if feature_dim < 1:
            raise ValueError("feature_dim must be positive")
        if not 1 <= top_k <= min(MAX_TOP_K, len(label_list)):
            raise ValueError(
                f"top_k must be within [1, {min(MAX_TOP_K, len(label_list))}]"
            )

        script_list = list(script) if script is not None else None
        if script_list is not None:
            if not script_list:
                raise ValueError("script must not be empty")
            unknown = [label for label in script_list if label not in label_list]
            if unknown:
                raise ValueError(f"script labels not in labels: {unknown}")
            if not 0.0 <= scripted_confidence <= 1.0:
                raise ValueError("scripted_confidence must be within [0, 1]")

        self._labels = tuple(label_list)
        self._feature_dim = feature_dim
        self._top_k = top_k
        self._script = script_list
        self._scripted_confidence = scripted_confidence
        self._script_position = 0
        self._lock = threading.Lock()

    @property
    def labels(self) -> Sequence[str]:
        return self._labels

    @property
    def feature_dim(self) -> int:
        return self._feature_dim

    def predict(self, features: FeatureVector) -> ClassifierOutput:
        values = [float(v) for v in features]
        if len(values) != self._feature_dim:
            raise ValueError(
                f"expected {self._feature_dim} features, got {len(values)}"
            )
        if not all(math.isfinite(v) for v in values):
            raise ValueError("features must be finite")
        try:
            packed = struct.pack(f"<{len(values)}f", *values)
        except OverflowError:
            raise ValueError("feature value outside the float32 range") from None
        digest = hashlib.sha256(packed).digest()

        if self._script is None:
            winner = int.from_bytes(digest[0:4], "little") % len(self._labels)
            confidence_units = _HASH_CONFIDENCE_MIN + (
                int.from_bytes(digest[4:6], "little") * _HASH_CONFIDENCE_SPAN // 0xFFFF
            )
        else:
            with self._lock:
                label = self._script[self._script_position % len(self._script)]
                self._script_position += 1
            winner = self._labels.index(label)
            confidence_units = int(self._scripted_confidence * _SCALE + 0.5)

        return self._build_output(winner, confidence_units, digest)

    def _build_output(
        self, winner: int, confidence_units: int, digest: bytes
    ) -> ClassifierOutput:
        n = len(self._labels)
        used = {winner}
        runner_ups: List[int] = []
        for i in range(self._top_k - 1):
            candidate = int.from_bytes(digest[6 + 2 * i : 8 + 2 * i], "little") % n
            while candidate in used:
                candidate = (candidate + 1) % n
            used.add(candidate)
            runner_ups.append(candidate)

        entries = [
            TopKEntry(label=self._labels[winner], confidence=confidence_units / _SCALE)
        ]
        # Runner-ups take 60%, then 40% of that, ... of the remaining probability
        # mass, capped at the winner's confidence so top_k stays ranked best-first
        # even when a scripted confidence is low.
        share = min((_SCALE - confidence_units) * 6 // 10, confidence_units)
        for index in runner_ups:
            entries.append(
                TopKEntry(label=self._labels[index], confidence=share / _SCALE)
            )
            share = share * 4 // 10

        return ClassifierOutput(
            label=self._labels[winner],
            confidence=confidence_units / _SCALE,
            top_k=entries,
            inference_ms=STUB_INFERENCE_MS,
        )
