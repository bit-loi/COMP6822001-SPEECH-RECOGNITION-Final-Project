"""Tests for the deterministic StubClassifier and its fit with the contract/mapper."""

import threading

import pytest
from models.classifier_schemas import ClassifierOutput
from pydantic import ValidationError
from services.classifier import FEATURE_DIM, SPEECH_COMMANDS_LABELS, Classifier
from services.command_mapper import CommandMapper
from services.stub_classifier import StubClassifier


def _ramp(offset=0.0):
    return [i * 0.25 - 10.0 + offset for i in range(FEATURE_DIM)]


# Golden vectors. backend-go/voice/stub_test.go pins the same three, so the Python
# and Go stubs are guaranteed to agree bit-for-bit.
GOLDEN = [
    (
        _ramp(),
        {
            "label": "marvin",
            "confidence": 0.6133,
            "top_k": [
                {"label": "marvin", "confidence": 0.6133},
                {"label": "wow", "confidence": 0.232},
                {"label": "learn", "confidence": 0.0928},
            ],
            "inference_ms": 0.5,
        },
    ),
    (
        [0.0] * FEATURE_DIM,
        {
            "label": "three",
            "confidence": 0.9591,
            "top_k": [
                {"label": "three", "confidence": 0.9591},
                {"label": "nine", "confidence": 0.0245},
                {"label": "one", "confidence": 0.0098},
            ],
            "inference_ms": 0.5,
        },
    ),
    (
        [((i * 37) % 11) / 7.0 - 0.5 for i in range(FEATURE_DIM)],
        {
            "label": "silence",
            "confidence": 0.9819,
            "top_k": [
                {"label": "silence", "confidence": 0.9819},
                {"label": "down", "confidence": 0.0108},
                {"label": "cat", "confidence": 0.0043},
            ],
            "inference_ms": 0.5,
        },
    ),
]


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch):
    monkeypatch.delenv("AMBATUCODE_CONFIDENCE_THRESHOLD", raising=False)
    monkeypatch.delenv("AMBATUCODE_COMMAND_MAP", raising=False)


# --- interface ----------------------------------------------------------------


def test_stub_satisfies_the_classifier_protocol():
    assert isinstance(StubClassifier(), Classifier)


def test_labels_are_the_37_classes_in_training_order():
    labels = StubClassifier().labels

    assert tuple(labels) == SPEECH_COMMANDS_LABELS
    assert len(labels) == 37
    assert list(labels) == sorted(labels)
    assert "silence" in labels and "unknown" in labels


def test_labels_agree_with_the_command_map():
    assert tuple(StubClassifier().labels) == CommandMapper.from_file().labels


def test_feature_dim_is_78():
    assert StubClassifier().feature_dim == FEATURE_DIM == 78


# --- determinism ----------------------------------------------------------------


@pytest.mark.parametrize(("features", "expected"), GOLDEN)
def test_golden_vectors(features, expected):
    assert StubClassifier().predict(features).model_dump() == expected


def test_same_features_always_give_the_same_prediction():
    first = StubClassifier().predict(_ramp())
    second = StubClassifier().predict(_ramp())
    third = StubClassifier()
    third.predict(_ramp(1.0))  # unrelated call in between changes nothing
    assert first == second == third.predict(_ramp())


def test_accepts_any_float_sequence():
    stub = StubClassifier()
    assert stub.predict(tuple(_ramp())) == stub.predict(_ramp())


def test_hash_mode_spreads_over_the_label_set_and_all_mapper_outcomes():
    stub = StubClassifier()
    mapper = CommandMapper.from_file()
    labels_seen, reasons_seen = set(), set()

    for n in range(1000):
        output = stub.predict(_ramp(n * 0.37))
        labels_seen.add(output.label)
        reasons_seen.add(mapper.map_output(output).reason)

    assert len(labels_seen) >= 30
    assert reasons_seen == {"mapped", "no_action_word", "below_threshold"}


@pytest.mark.parametrize("offset", [0.0, 0.5, 3.0, -7.0, 123.456])
def test_outputs_always_satisfy_the_contract(offset):
    output = StubClassifier().predict(_ramp(offset))

    assert isinstance(output, ClassifierOutput)
    assert len(output.top_k) == 3
    assert len({entry.label for entry in output.top_k}) == 3
    assert {entry.label for entry in output.top_k} <= set(SPEECH_COMMANDS_LABELS)
    assert 0.5 <= output.confidence <= 0.99
    assert output.inference_ms == 0.5


@pytest.mark.parametrize("top_k", [1, 2, 5, 10])
def test_top_k_size_is_configurable(top_k):
    output = StubClassifier(top_k=top_k).predict(_ramp())

    assert len(output.top_k) == top_k
    assert len({entry.label for entry in output.top_k}) == top_k


@pytest.mark.parametrize("top_k", [0, -1, 11, 100])
def test_invalid_top_k_is_rejected(top_k):
    with pytest.raises(ValueError):
        StubClassifier(top_k=top_k)


# --- input validation -------------------------------------------------------------


@pytest.mark.parametrize("length", [0, 1, 77, 79, 156])
def test_wrong_feature_length_is_rejected(length):
    with pytest.raises(ValueError, match="expected 78 features"):
        StubClassifier().predict([0.0] * length)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_features_are_rejected(bad):
    features = _ramp()
    features[10] = bad
    with pytest.raises(ValueError, match="finite"):
        StubClassifier().predict(features)


def test_values_outside_float32_range_are_rejected():
    features = _ramp()
    features[0] = 1e39
    with pytest.raises(ValueError, match="float32"):
        StubClassifier().predict(features)


# --- script mode ------------------------------------------------------------------


def test_script_mode_returns_labels_in_order_and_cycles():
    stub = StubClassifier(script=["go", "stop", "left"])

    labels = [stub.predict(_ramp(n)).label for n in range(7)]

    assert labels == ["go", "stop", "left", "go", "stop", "left", "go"]


def test_script_mode_uses_the_configured_confidence():
    stub = StubClassifier(script=["go"], scripted_confidence=0.8)

    assert stub.predict(_ramp()).confidence == 0.8
    assert StubClassifier(script=["go"]).predict(_ramp()).confidence == 0.9


@pytest.mark.parametrize("confidence", [0.0, 0.1, 0.3, 0.5, 1.0])
def test_script_mode_keeps_top_k_valid_even_at_low_confidence(confidence):
    output = StubClassifier(script=["go"], scripted_confidence=confidence).predict(
        _ramp()
    )

    confidences = [entry.confidence for entry in output.top_k]
    assert confidences == sorted(confidences, reverse=True)
    assert output.top_k[0].label == "go"


def test_script_mode_is_thread_safe():
    stub = StubClassifier(script=["go", "stop"])
    results, lock = [], threading.Lock()

    def worker():
        local = [stub.predict(_ramp()).label for _ in range(250)]
        with lock:
            results.extend(local)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert results.count("go") == results.count("stop") == 500


@pytest.mark.parametrize(
    "kwargs",
    [
        {"script": []},
        {"script": ["not-a-label"]},
        {"script": ["go"], "scripted_confidence": 1.5},
        {"script": ["go"], "scripted_confidence": -0.1},
        {"labels": []},
        {"labels": ["a", "a"]},
        {"feature_dim": 0},
    ],
)
def test_invalid_construction_is_rejected(kwargs):
    with pytest.raises(ValueError):
        StubClassifier(**kwargs)


# --- stub -> mapper (Python half of the end-to-end flow) -------------------------------

COMMAND_LABELS = {
    "go": "execute_active_file",
    "stop": "stop_execution",
    "on": "toggle_focus_mode",
    "off": "toggle_focus_mode",
    "up": "scroll",
    "down": "scroll",
    "left": "switch_tab",
    "right": "switch_tab",
    "yes": "confirm",
    "no": "cancel",
    "forward": "redo",
    "backward": "undo",
    "learn": "toggle_task_chunking",
    "visual": "toggle_theme",
    "follow": "toggle_chat_panel",
    "zero": "select_tab_0",
    "nine": "select_tab_9",
}


@pytest.mark.parametrize(("label", "action"), sorted(COMMAND_LABELS.items()))
def test_scripted_stub_drives_the_mapper(label, action):
    stub = StubClassifier(script=[label], scripted_confidence=0.95)

    result = CommandMapper.from_file().map_output(stub.predict(_ramp()))

    assert result.reason == "mapped"
    assert result.action.action == action


def test_scripted_low_confidence_command_is_not_executed():
    stub = StubClassifier(script=["go"], scripted_confidence=0.6)

    result = CommandMapper.from_file().map_output(stub.predict(_ramp()))

    assert result.reason == "below_threshold"
    assert result.action is None


def test_scripted_no_action_word_is_not_executed():
    stub = StubClassifier(script=["cat"], scripted_confidence=0.99)

    result = CommandMapper.from_file().map_output(stub.predict(_ramp()))

    assert result.reason == "no_action_word"
    assert result.action is None


def test_contract_violations_are_still_caught_by_validation():
    with pytest.raises(ValidationError):
        ClassifierOutput(label="go", confidence=0.9, top_k=[], inference_ms=1.0)
