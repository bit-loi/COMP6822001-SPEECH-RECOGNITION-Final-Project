"""Maps a recognised keyword to an editor action.

The mapping lives in ``command_map.json`` next to this file. That file is the
single source of truth: the Go streaming pipeline (``backend-go/voice/mapper.go``)
reads the very same JSON, so the two implementations cannot drift apart.

Decision order for ``CommandMapper.map(label, confidence)``:

1. label listed under ``no_action``      -> no action, reason ``no_action_word``
2. label not in the map at all           -> no action, reason ``unknown_label``
3. ``confidence`` < threshold            -> no action, reason ``below_threshold``
4. otherwise                             -> the configured action, reason ``mapped``

The threshold is *inclusive*: ``confidence == threshold`` fires the action.
It is resolved in this order: constructor argument, then the
``AMBATUCODE_CONFIDENCE_THRESHOLD`` environment variable, then
``confidence_threshold`` in the JSON file (0.75 by default).
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple, Union

from models.classifier_schemas import ClassifierOutput
from pydantic import BaseModel, Field, model_validator

DEFAULT_CONFIDENCE_THRESHOLD = 0.75
DEFAULT_COMMAND_MAP_PATH = Path(__file__).resolve().with_name("command_map.json")

THRESHOLD_ENV_VAR = "AMBATUCODE_CONFIDENCE_THRESHOLD"
COMMAND_MAP_ENV_VAR = "AMBATUCODE_COMMAND_MAP"

MapReason = Literal["mapped", "below_threshold", "no_action_word", "unknown_label"]


class CommandAction(BaseModel):
    """An action the frontend should perform, e.g. ``switch_tab`` + ``direction``."""

    action: str
    params: Dict[str, str] = Field(default_factory=dict)


class MapResult(BaseModel):
    """Outcome of mapping one prediction. ``action`` is ``None`` unless ``reason == 'mapped'``."""

    label: str
    confidence: float
    reason: MapReason
    action: Optional[CommandAction] = None


class _CommandSpec(BaseModel):
    action: str = Field(min_length=1)
    params: Dict[str, str] = Field(default_factory=dict)


class _CommandMapConfig(BaseModel):
    version: int = 1
    confidence_threshold: float = Field(DEFAULT_CONFIDENCE_THRESHOLD, ge=0.0, le=1.0)
    commands: Dict[str, _CommandSpec]
    no_action: List[str]

    @model_validator(mode="after")
    def _labels_are_unique(self) -> "_CommandMapConfig":
        duplicates = sorted({l for l in self.no_action if self.no_action.count(l) > 1})
        if duplicates:
            raise ValueError(f"duplicate labels in no_action: {duplicates}")

        overlap = sorted(set(self.commands) & set(self.no_action))
        if overlap:
            raise ValueError(f"labels listed as both command and no_action: {overlap}")
        return self


def _validated_threshold(value: Union[int, float], source: str) -> float:
    threshold = float(value)
    if not 0.0 <= threshold <= 1.0:
        raise ValueError(
            f"confidence threshold from {source} must be within [0, 1], got {threshold}"
        )
    return threshold


def _threshold_from_environment() -> Optional[float]:
    raw = os.environ.get(THRESHOLD_ENV_VAR)
    if raw is None or raw.strip() == "":
        return None
    try:
        parsed = float(raw)
    except ValueError:
        raise ValueError(f"{THRESHOLD_ENV_VAR} must be a number, got {raw!r}") from None
    return _validated_threshold(parsed, THRESHOLD_ENV_VAR)


class CommandMapper:
    """Looks up the editor action for a (label, confidence) prediction."""

    def __init__(
        self, config: _CommandMapConfig, confidence_threshold: Optional[float] = None
    ):
        if confidence_threshold is not None:
            threshold = _validated_threshold(
                confidence_threshold, "constructor argument"
            )
        else:
            env_threshold = _threshold_from_environment()
            threshold = (
                env_threshold
                if env_threshold is not None
                else config.confidence_threshold
            )

        self._threshold = threshold
        self._commands: Dict[str, CommandAction] = {
            label: CommandAction(action=spec.action, params=dict(spec.params))
            for label, spec in config.commands.items()
        }
        self._no_action = frozenset(config.no_action)

    @classmethod
    def from_dict(
        cls,
        data: Dict[str, object],
        confidence_threshold: Optional[float] = None,
    ) -> "CommandMapper":
        """Build a mapper from an already-parsed map; raises ``ValidationError`` if malformed."""
        return cls(
            _CommandMapConfig.model_validate(data),
            confidence_threshold=confidence_threshold,
        )

    @classmethod
    def from_file(
        cls,
        path: Union[str, Path, None] = None,
        confidence_threshold: Optional[float] = None,
    ) -> "CommandMapper":
        """Load the map from ``path``, else ``$AMBATUCODE_COMMAND_MAP``, else the bundled file."""
        resolved = Path(
            path or os.environ.get(COMMAND_MAP_ENV_VAR) or DEFAULT_COMMAND_MAP_PATH
        )
        with open(resolved, "r", encoding="utf-8") as handle:
            return cls.from_dict(
                json.load(handle), confidence_threshold=confidence_threshold
            )

    @property
    def confidence_threshold(self) -> float:
        return self._threshold

    @property
    def labels(self) -> Tuple[str, ...]:
        """Every label this mapper knows about, sorted (the model's class order)."""
        return tuple(sorted(set(self._commands) | self._no_action))

    def map(self, label: str, confidence: float) -> MapResult:
        if label in self._no_action:
            return MapResult(
                label=label, confidence=confidence, reason="no_action_word"
            )

        command = self._commands.get(label)
        if command is None:
            return MapResult(label=label, confidence=confidence, reason="unknown_label")

        if confidence < self._threshold:
            return MapResult(
                label=label, confidence=confidence, reason="below_threshold"
            )

        return MapResult(
            label=label,
            confidence=confidence,
            reason="mapped",
            action=command.model_copy(deep=True),
        )

    def map_output(self, output: ClassifierOutput) -> MapResult:
        return self.map(output.label, output.confidence)
