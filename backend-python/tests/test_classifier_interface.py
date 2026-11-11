"""Tests for the Classifier protocol and the ClassifierOutput contract."""

import pytest
from models.classifier_schemas import ClassifierOutput, TopKEntry
from pydantic import ValidationError
from services.classifier import Classifier


def _output(**overrides):
    payload = {
        "label": "go",
        "confidence": 0.9,
        "top_k": [
            {"label": "go", "confidence": 0.9},
            {"label": "no", "confidence": 0.06},
            {"label": "on", "confidence": 0.02},
        ],
        "inference_ms": 1.5,
    }
    payload.update(overrides)
    return ClassifierOutput(**payload)


class _Conforming:
    labels = ("go", "no")
    feature_dim = 78

    def predict(self, features):
        return _output()


class _MissingPredict:
    labels = ("go",)
    feature_dim = 78


def test_structural_typing_accepts_any_class_with_the_right_members():
    assert isinstance(_Conforming(), Classifier)


def test_object_without_predict_is_not_a_classifier():
    assert not isinstance(_MissingPredict(), Classifier)


def test_contract_has_exactly_the_documented_fields():
    dumped = _output().model_dump()
    assert set(dumped) == {"label", "confidence", "top_k", "inference_ms"}
    assert all(set(entry) == {"label", "confidence"} for entry in dumped["top_k"])


def test_contract_round_trips_through_json():
    original = _output()
    assert ClassifierOutput.model_validate_json(original.model_dump_json()) == original


def test_top_k_entries_are_typed():
    assert all(isinstance(entry, TopKEntry) for entry in _output().top_k)


@pytest.mark.parametrize(
    "overrides",
    [
        {"confidence": 1.2},
        {"confidence": -0.1},
        {"inference_ms": -1.0},
        {"top_k": []},
        # not sorted best-first
        {
            "top_k": [
                {"label": "go", "confidence": 0.9},
                {"label": "no", "confidence": 0.95},
            ]
        },
        # head of top_k disagrees with the predicted label
        {"top_k": [{"label": "no", "confidence": 0.9}]},
        # head of top_k disagrees with the predicted confidence
        {"top_k": [{"label": "go", "confidence": 0.5}]},
        # entry confidence out of range
        {"top_k": [{"label": "go", "confidence": 1.5}]},
    ],
)
def test_invalid_outputs_are_rejected(overrides):
    with pytest.raises(ValidationError):
        _output(**overrides)
