"""Unit tests for services/command_mapper.py and services/command_map.json.

The expectations below restate the specification independently. They are
deliberately NOT derived from command_map.json, so a typo in the JSON fails here.
"""

import json
from pathlib import Path

import pytest
from models.classifier_schemas import ClassifierOutput
from pydantic import ValidationError
from services.command_mapper import (
    COMMAND_MAP_ENV_VAR,
    DEFAULT_COMMAND_MAP_PATH,
    DEFAULT_CONFIDENCE_THRESHOLD,
    THRESHOLD_ENV_VAR,
    CommandMapper,
)

# label -> (action, params)
EXPECTED_COMMANDS = {
    "go": ("execute_active_file", {}),
    "stop": ("stop_execution", {}),
    "on": ("toggle_focus_mode", {"direction": "enter"}),
    "off": ("toggle_focus_mode", {"direction": "exit"}),
    "up": ("scroll", {"direction": "up"}),
    "down": ("scroll", {"direction": "down"}),
    "left": ("switch_tab", {"direction": "left"}),
    "right": ("switch_tab", {"direction": "right"}),
    "yes": ("confirm", {}),
    "no": ("cancel", {}),
    "forward": ("redo", {}),
    "backward": ("undo", {}),
    "learn": ("toggle_task_chunking", {}),
    "visual": ("toggle_theme", {}),
    "follow": ("toggle_chat_panel", {}),
    "zero": ("select_tab_0", {}),
    "one": ("select_tab_1", {}),
    "two": ("select_tab_2", {}),
    "three": ("select_tab_3", {}),
    "four": ("select_tab_4", {}),
    "five": ("select_tab_5", {}),
    "six": ("select_tab_6", {}),
    "seven": ("select_tab_7", {}),
    "eight": ("select_tab_8", {}),
    "nine": ("select_tab_9", {}),
}

NO_ACTION_WORDS = [
    "bed", "bird", "cat", "dog", "happy", "house", "marvin", "sheila", "tree", "wow",
    "unknown", "silence",
]  # fmt: skip

# The 35 keywords of Google Speech Commands v2.
SPEECH_COMMANDS_V2_KEYWORDS = [
    "backward", "bed", "bird", "cat", "dog", "down", "eight", "five", "follow", "forward",
    "four", "go", "happy", "house", "learn", "left", "marvin", "nine", "no", "off", "on",
    "one", "right", "seven", "sheila", "six", "stop", "three", "tree", "two", "up", "visual",
    "wow", "yes", "zero",
]  # fmt: skip

CONFIDENT = 0.99


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch):
    """Keep a developer's shell from leaking overrides into the tests."""
    monkeypatch.delenv(THRESHOLD_ENV_VAR, raising=False)
    monkeypatch.delenv(COMMAND_MAP_ENV_VAR, raising=False)


@pytest.fixture
def mapper():
    return CommandMapper.from_file()


def _valid_map(**overrides):
    data = {
        "version": 1,
        "confidence_threshold": 0.75,
        "commands": {"go": {"action": "execute_active_file"}},
        "no_action": ["cat"],
    }
    data.update(overrides)
    return data


# --- every mapping ---------------------------------------------------------


@pytest.mark.parametrize("label", sorted(EXPECTED_COMMANDS))
def test_every_command_word_maps_to_its_action(mapper, label):
    expected_action, expected_params = EXPECTED_COMMANDS[label]

    result = mapper.map(label, CONFIDENT)

    assert result.reason == "mapped"
    assert result.action is not None
    assert result.action.action == expected_action
    assert result.action.params == expected_params
    assert result.label == label
    assert result.confidence == CONFIDENT


@pytest.mark.parametrize("label", NO_ACTION_WORDS)
@pytest.mark.parametrize("confidence", [1.0, 0.9, 0.0])
def test_no_action_words_never_trigger_anything(mapper, label, confidence):
    result = mapper.map(label, confidence)

    assert result.action is None
    assert result.reason == "no_action_word"


def test_digits_map_to_numbered_tab_actions(mapper):
    digits = [
        "zero",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
    ]
    for number, word in enumerate(digits):
        assert mapper.map(word, CONFIDENT).action.action == f"select_tab_{number}"


def test_directional_commands_carry_a_direction_param(mapper):
    assert mapper.map("on", CONFIDENT).action.params == {"direction": "enter"}
    assert mapper.map("off", CONFIDENT).action.params == {"direction": "exit"}
    assert mapper.map("up", CONFIDENT).action.params == {"direction": "up"}
    assert mapper.map("down", CONFIDENT).action.params == {"direction": "down"}
    assert mapper.map("left", CONFIDENT).action.params == {"direction": "left"}
    assert mapper.map("right", CONFIDENT).action.params == {"direction": "right"}


# --- label coverage ---------------------------------------------------------


def test_mapper_knows_exactly_the_37_classes(mapper):
    expected = set(SPEECH_COMMANDS_V2_KEYWORDS) | {"silence", "unknown"}

    assert len(SPEECH_COMMANDS_V2_KEYWORDS) == 35
    assert len(expected) == 37
    assert set(mapper.labels) == expected
    assert len(mapper.labels) == 37


def test_commands_and_no_action_words_partition_the_labels():
    assert set(EXPECTED_COMMANDS).isdisjoint(NO_ACTION_WORDS)
    assert len(EXPECTED_COMMANDS) + len(NO_ACTION_WORDS) == 37


def test_labels_are_sorted_in_training_order(mapper):
    assert list(mapper.labels) == sorted(mapper.labels)


def test_bundled_json_matches_the_expected_tables():
    data = json.loads(DEFAULT_COMMAND_MAP_PATH.read_text(encoding="utf-8"))

    assert {
        k: (v["action"], v.get("params", {})) for k, v in data["commands"].items()
    } == EXPECTED_COMMANDS
    assert sorted(data["no_action"]) == sorted(NO_ACTION_WORDS)


# --- confidence threshold ----------------------------------------------------


def test_default_threshold_is_0_75(mapper):
    assert DEFAULT_CONFIDENCE_THRESHOLD == 0.75
    assert mapper.confidence_threshold == 0.75
    assert (
        json.loads(DEFAULT_COMMAND_MAP_PATH.read_text(encoding="utf-8"))[
            "confidence_threshold"
        ]
        == 0.75
    )


@pytest.mark.parametrize(
    ("confidence", "fires"),
    [
        (1.0, True),
        (0.99, True),
        (0.7500001, True),
        (0.75, True),  # inclusive boundary
        (0.7499999, False),
        (0.5, False),
        (0.0, False),
    ],
)
def test_default_threshold_boundary(mapper, confidence, fires):
    result = mapper.map("go", confidence)

    assert (result.action is not None) is fires
    assert result.reason == ("mapped" if fires else "below_threshold")


def test_below_threshold_keeps_label_and_confidence_for_reporting(mapper):
    result = mapper.map("stop", 0.6)

    assert result.action is None
    assert result.reason == "below_threshold"
    assert result.label == "stop"
    assert result.confidence == 0.6


def test_threshold_is_configurable_via_constructor():
    strict = CommandMapper.from_file(confidence_threshold=0.9)
    lenient = CommandMapper.from_file(confidence_threshold=0.5)

    assert strict.confidence_threshold == 0.9
    assert strict.map("go", 0.85).action is None
    assert strict.map("go", 0.9).action is not None
    assert lenient.map("go", 0.6).action is not None
    assert lenient.map("go", 0.49).action is None


def test_threshold_extremes():
    always = CommandMapper.from_file(confidence_threshold=0.0)
    only_certain = CommandMapper.from_file(confidence_threshold=1.0)

    assert always.map("go", 0.0).action is not None
    assert only_certain.map("go", 0.999).action is None
    assert only_certain.map("go", 1.0).action is not None


def test_threshold_can_come_from_the_json_file(tmp_path):
    path = tmp_path / "map.json"
    path.write_text(json.dumps(_valid_map(confidence_threshold=0.6)), encoding="utf-8")

    from_file = CommandMapper.from_file(path)

    assert from_file.confidence_threshold == 0.6
    assert from_file.map("go", 0.65).action is not None
    assert from_file.map("go", 0.55).action is None


def test_threshold_environment_variable_overrides_the_file(monkeypatch):
    monkeypatch.setenv(THRESHOLD_ENV_VAR, "0.9")

    assert CommandMapper.from_file().confidence_threshold == 0.9


def test_constructor_argument_beats_the_environment_variable(monkeypatch):
    monkeypatch.setenv(THRESHOLD_ENV_VAR, "0.9")

    assert CommandMapper.from_file(confidence_threshold=0.3).confidence_threshold == 0.3


def test_blank_environment_variable_is_ignored(monkeypatch):
    monkeypatch.setenv(THRESHOLD_ENV_VAR, "   ")

    assert CommandMapper.from_file().confidence_threshold == 0.75


@pytest.mark.parametrize("raw", ["abc", "1.5", "-0.2"])
def test_bad_environment_threshold_is_reported_not_ignored(monkeypatch, raw):
    monkeypatch.setenv(THRESHOLD_ENV_VAR, raw)

    with pytest.raises(ValueError):
        CommandMapper.from_file()


@pytest.mark.parametrize("value", [-0.01, 1.01, 5])
def test_out_of_range_constructor_threshold_is_rejected(value):
    with pytest.raises(ValueError):
        CommandMapper.from_file(confidence_threshold=value)


# --- unknown labels and ClassifierOutput ---------------------------------------


@pytest.mark.parametrize("label", ["banana", "", "GO", "Go", " go"])
def test_labels_must_match_exactly(mapper, label):
    result = mapper.map(label, CONFIDENT)

    assert result.action is None
    assert result.reason == "unknown_label"


def test_map_output_uses_label_and_confidence_of_the_prediction(mapper):
    prediction = ClassifierOutput(
        label="left",
        confidence=0.91,
        top_k=[
            {"label": "left", "confidence": 0.91},
            {"label": "up", "confidence": 0.05},
        ],
        inference_ms=2.0,
    )

    result = mapper.map_output(prediction)

    assert result.action.action == "switch_tab"
    assert result.action.params == {"direction": "left"}


def test_map_output_respects_the_threshold(mapper):
    prediction = ClassifierOutput(
        label="left",
        confidence=0.5,
        top_k=[{"label": "left", "confidence": 0.5}],
        inference_ms=2.0,
    )

    assert mapper.map_output(prediction).reason == "below_threshold"


def test_returned_actions_are_independent_copies(mapper):
    first = mapper.map("left", CONFIDENT)
    first.action.params["direction"] = "tampered"

    assert mapper.map("left", CONFIDENT).action.params == {"direction": "left"}


def test_result_serialises_to_the_documented_shape(mapper):
    mapped = mapper.map("left", 0.9).model_dump()
    ignored = mapper.map("cat", 0.9).model_dump()

    assert mapped == {
        "label": "left",
        "confidence": 0.9,
        "reason": "mapped",
        "action": {"action": "switch_tab", "params": {"direction": "left"}},
    }
    assert ignored == {
        "label": "cat",
        "confidence": 0.9,
        "reason": "no_action_word",
        "action": None,
    }


# --- loading and validating the map ---------------------------------------------


def test_command_map_path_can_come_from_the_environment(tmp_path, monkeypatch):
    path = tmp_path / "custom.json"
    path.write_text(
        json.dumps(_valid_map(commands={"go": {"action": "custom_action"}})),
        encoding="utf-8",
    )
    monkeypatch.setenv(COMMAND_MAP_ENV_VAR, str(path))

    assert (
        CommandMapper.from_file().map("go", CONFIDENT).action.action == "custom_action"
    )


def test_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        CommandMapper.from_file(Path(tmp_path) / "nope.json")


@pytest.mark.parametrize(
    "bad_map",
    [
        _valid_map(
            commands={"go": {"action": "x"}}, no_action=["go"]
        ),  # label in both sections
        _valid_map(no_action=["cat", "cat"]),  # duplicate no-action label
        _valid_map(commands={"go": {"action": ""}}),  # empty action name
        _valid_map(commands={"go": {}}),  # action missing
        _valid_map(confidence_threshold=1.5),
        _valid_map(confidence_threshold=-0.1),
        {"confidence_threshold": 0.75, "no_action": []},  # commands missing
        {"confidence_threshold": 0.75, "commands": {}},  # no_action missing
    ],
)
def test_malformed_maps_are_rejected(bad_map):
    with pytest.raises(ValidationError):
        CommandMapper.from_dict(bad_map)
