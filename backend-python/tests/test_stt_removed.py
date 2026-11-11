"""The Gemini/ffmpeg/cloud speech-to-text path must stay gone (hard constraint)."""

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers import voice
from services.gemini_service import GeminiService

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(voice.router)
    return TestClient(app)


def test_gemini_service_has_no_transcription_method():
    assert not hasattr(GeminiService, "transcribe_audio")


@pytest.mark.parametrize("path", ["/api/voice/stt", "/api/voice/transcribe-audio"])
def test_stt_endpoints_are_not_registered(client, path):
    registered = {getattr(route, "path", None) for route in voice.router.routes}
    assert path not in registered
    assert (
        client.post(path, files={"audio": ("a.wav", b"RIFF", "audio/wav")}).status_code
        == 404
    )


@pytest.mark.parametrize(
    "attribute", ["sr", "recognizer", "AudioSegment", "_do_transcribe"]
)
def test_voice_router_has_no_stt_leftovers(attribute):
    assert not hasattr(voice, attribute)


def test_stt_dependencies_removed_from_requirements():
    requirements = (
        (BACKEND_DIR / "requirements.txt").read_text(encoding="utf-8").lower()
    )
    for package in ("speechrecognition", "pydub"):
        assert package not in requirements


def test_text_based_voice_routes_are_kept():
    registered = {getattr(route, "path", None) for route in voice.router.routes}
    assert "/api/voice/enhance-transcript" in registered
    assert "/api/voice/process" in registered
    assert "/api/voice/process-stream" in registered
