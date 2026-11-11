"""Classifier interface for isolated-keyword recognition.

AmbatuCode recognises a closed vocabulary (Google Speech Commands v2: 35 keywords
plus ``silence`` and ``unknown`` = 37 classes) with a *classical* model. No deep
learning and no cloud APIs. This module defines the seam the real trained model
plugs into; nothing here depends on a particular model family.

Input
-----
A fixed-length feature vector of ``feature_dim`` floats (78 for the current
pipeline). It is the per-utterance pooling used by the repo's ``models.py``
(``pool_features``): the mean of each of the 39 channels, followed by the
standard deviation (ddof=0) of each of the 39 channels, where the 39 channels are
13 MFCC, 13 delta and 13 delta-delta coefficients, in that order. The MFCC
parameters live in ``backend-go/voice/params.go`` and must match whatever
produced the training features.

Output
------
A ``ClassifierOutput`` (see ``models/classifier_schemas.py``).

Plugging in a real model
------------------------
Implement ``labels``, ``feature_dim`` and ``predict`` on any class; structural
typing means no inheritance is needed::

    class SklearnClassifier:
        def __init__(self, pipeline, labels):
            self._pipeline, self._labels = pipeline, tuple(labels)

        @property
        def labels(self):
            return self._labels

        @property
        def feature_dim(self):
            return 78

        def predict(self, features):
            ...  # run the model, build and return a ClassifierOutput
"""

from typing import Protocol, Sequence, runtime_checkable

from models.classifier_schemas import ClassifierOutput

FeatureVector = Sequence[float]


@runtime_checkable
class Classifier(Protocol):
    """Maps one pooled utterance feature vector to a ranked keyword prediction."""

    @property
    def labels(self) -> Sequence[str]:
        """Class labels in the model's output order (training order)."""
        ...

    @property
    def feature_dim(self) -> int:
        """Length of the feature vector ``predict`` expects."""
        ...

    def predict(self, features: FeatureVector) -> ClassifierOutput:
        """Classify ``features``.

        Implementations must raise ``ValueError`` when ``len(features)`` differs
        from ``feature_dim`` rather than silently truncating or padding.
        """
        ...
