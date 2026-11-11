"""Typed output contract for the isolated-keyword classifier.

Every ``Classifier`` implementation (stub, scikit-learn, ONNX, ...) must return
this exact shape. The Go pipeline mirrors it in ``backend-go/voice`` so both
sides agree on the wire format::

    {
      "label": "go",
      "confidence": 0.93,
      "top_k": [{"label": "go", "confidence": 0.93}, ...],
      "inference_ms": 1.2
    }

``confidence`` values are probabilities in ``[0, 1]``; the command mapper
compares them against its configurable threshold.
"""

import math
from typing import List

from pydantic import BaseModel, Field, model_validator


class TopKEntry(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)


class ClassifierOutput(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    top_k: List[TopKEntry] = Field(min_length=1)
    inference_ms: float = Field(ge=0.0)

    @model_validator(mode="after")
    def _top_k_is_consistent(self) -> "ClassifierOutput":
        """``top_k`` is ranked best-first and its head is the predicted label."""
        confidences = [entry.confidence for entry in self.top_k]
        if confidences != sorted(confidences, reverse=True):
            raise ValueError("top_k must be sorted by confidence, highest first")

        best = self.top_k[0]
        if best.label != self.label or not math.isclose(
            best.confidence, self.confidence, rel_tol=1e-9, abs_tol=1e-9
        ):
            raise ValueError("top_k[0] must equal the predicted label and confidence")
        return self
