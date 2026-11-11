"""Route-level tests for routers/voice.py (no network; Gemini is stubbed)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers import voice

# The frontend (ChatPanel.tsx) calls this exact URL.
ENHANCE_PATH = "/api/voice/enhance-transcript"


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(voice.router)
    return TestClient(app)


def _registered(method: str, path: str) -> bool:
    return any(
        getattr(route, "path", None) == path
        and method in getattr(route, "methods", set())
        for route in voice.router.routes
    )


def test_enhance_transcript_route_is_registered():
    assert _registered("POST", ENHANCE_PATH)


def test_enhance_transcript_forwards_request_to_gemini(client, monkeypatch):
    captured = {}

    async def fake_enhance(**kwargs):
        captured.update(kwargs)
        return {
            "cleaned_transcript": "create a login function",
            "intent_type": "generate",
            "intent_label": "Generate Function",
            "confidence": 0.9,
            "suggested_action": "Create a login function",
        }

    monkeypatch.setattr(voice.gemini_service, "enhance_voice_transcript", fake_enhance)

    response = client.post(
        ENHANCE_PATH,
        json={
            "transcript": "buat fungsi login",
            "file_language": "javascript",
            "ui_language": "id",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["cleaned_transcript"] == "create a login function"
    assert body["intent_type"] == "generate"
    assert captured == {
        "raw_transcript": "buat fungsi login",
        "file_language": "javascript",
        "surrounding_code": "",
        "ui_language": "id",
    }


def test_enhance_transcript_falls_back_when_gemini_fails(client, monkeypatch):
    async def failing_enhance(**kwargs):
        raise RuntimeError("gemini unavailable")

    monkeypatch.setattr(
        voice.gemini_service, "enhance_voice_transcript", failing_enhance
    )

    response = client.post(ENHANCE_PATH, json={"transcript": "explain this"})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["cleaned_transcript"] == "explain this"
    assert body["intent_type"] == "chat"
    assert "gemini unavailable" in body["error"]
