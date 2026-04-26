"""Tests for the /understand endpoint and the surviving /speech-to-text route.

The old /translate endpoint has been replaced by /understand.
"""

from __future__ import annotations

import io
import json

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _understand_payload(**overrides) -> dict:
    base = {
        "message_text": "Can you break a leg on this? We need it ASAP.",
        "user_preferences": {"reading_level": "general", "language": "fr"},
        "context": {"channel_tone": "casual"},
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# /understand – success path
# ---------------------------------------------------------------------------

def test_understand_success_returns_all_fields(client, auth_headers):
    response = client.post("/understand", headers=auth_headers, json=_understand_payload())
    assert response.status_code == 200
    data = response.json()["data"]
    assert "simplified" in data
    assert "explanation" in data
    assert isinstance(data["idioms"], list)
    assert "tone_hint" in data
    assert "translated" in data


def test_understand_simplified_is_non_empty(client, auth_headers):
    response = client.post("/understand", headers=auth_headers, json=_understand_payload())
    assert response.status_code == 200
    assert response.json()["data"]["simplified"]


def test_understand_translated_is_non_empty(client, auth_headers):
    response = client.post("/understand", headers=auth_headers, json=_understand_payload())
    assert response.status_code == 200
    assert response.json()["data"]["translated"]


def test_understand_idioms_structure(client, auth_headers):
    response = client.post("/understand", headers=auth_headers, json=_understand_payload())
    assert response.status_code == 200
    for idiom in response.json()["data"]["idioms"]:
        assert "phrase" in idiom
        assert "meaning" in idiom
        assert "localized_equivalent" in idiom


# ---------------------------------------------------------------------------
# /understand – minimal payload (defaults)
# ---------------------------------------------------------------------------

def test_understand_minimal_payload(client, auth_headers):
    """Only message_text is required; preferences and context default safely."""
    response = client.post(
        "/understand",
        headers=auth_headers,
        json={"message_text": "Hello team"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["simplified"]


# ---------------------------------------------------------------------------
# /understand – validation
# ---------------------------------------------------------------------------

def test_understand_empty_text_rejected(client, auth_headers):
    response = client.post("/understand", headers=auth_headers, json={"message_text": ""})
    assert response.status_code == 422


def test_understand_text_too_long_rejected(client, auth_headers):
    response = client.post("/understand", headers=auth_headers, json={"message_text": "x" * 5000})
    assert response.status_code == 422


def test_understand_requires_auth(client):
    response = client.post("/understand", json=_understand_payload())
    assert response.status_code == 401


def test_understand_extra_fields_rejected(client, auth_headers):
    payload = _understand_payload()
    payload["unknown_field"] = "oops"
    response = client.post("/understand", headers=auth_headers, json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# /understand – fail-open (AI unavailable)
# ---------------------------------------------------------------------------

def test_understand_fails_open_when_groq_raises(client, auth_headers, monkeypatch):
    """When Groq is down the endpoint returns 200 with the original text."""

    async def broken_chat(*args, **kwargs):
        raise RuntimeError("groq down")

    monkeypatch.setattr("app.services.groq_client.groq_client.chat", broken_chat)

    response = client.post(
        "/understand",
        headers=auth_headers,
        json={"message_text": "Stand by for updates"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["simplified"] == "Stand by for updates"
    assert data["translated"] == "Stand by for updates"
    assert data["idioms"] == []


def test_understand_fails_open_on_malformed_json(client, auth_headers, monkeypatch):
    """When Groq returns garbage JSON the endpoint still returns 200."""

    async def bad_json_chat(*args, **kwargs):
        return "not valid json {"

    monkeypatch.setattr("app.services.groq_client.groq_client.chat", bad_json_chat)

    response = client.post(
        "/understand",
        headers=auth_headers,
        json={"message_text": "Quick sync?"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["simplified"] == "Quick sync?"


# ---------------------------------------------------------------------------
# /understand – rate limiting
# ---------------------------------------------------------------------------

def test_understand_rate_limited(client, auth_headers, monkeypatch):
    async def deny(*args, **kwargs):
        from fastapi import HTTPException
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "slow down"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    response = client.post("/understand", headers=auth_headers, json=_understand_payload())
    assert response.status_code == 429


# ---------------------------------------------------------------------------
# /understand – reading levels
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("level", ["simple", "general", "advanced"])
def test_understand_reading_levels(client, auth_headers, level):
    payload = _understand_payload()
    payload["user_preferences"] = {"reading_level": level, "language": "en"}
    response = client.post("/understand", headers=auth_headers, json=payload)
    assert response.status_code == 200
    assert response.json()["data"]["simplified"]


# ---------------------------------------------------------------------------
# /understand – context fields optional
# ---------------------------------------------------------------------------

def test_understand_without_context(client, auth_headers):
    response = client.post(
        "/understand",
        headers=auth_headers,
        json={"message_text": "Let's circle back on this later."},
    )
    assert response.status_code == 200


def test_understand_with_full_context(client, auth_headers):
    response = client.post(
        "/understand",
        headers=auth_headers,
        json={
            "message_text": "We need to touch base ASAP.",
            "user_preferences": {"reading_level": "simple", "language": "es"},
            "context": {"thread": "sprint planning", "channel_tone": "urgent"},
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["simplified"]
    assert data["translated"]


# ---------------------------------------------------------------------------
# /speech-to-text – still present
# ---------------------------------------------------------------------------

def test_speech_to_text_rejects_non_audio(client, auth_headers):
    """Endpoint must reject files that are not audio."""
    response = client.post(
        "/speech-to-text",
        headers=auth_headers,
        files={"audio": ("test.txt", io.BytesIO(b"not audio"), "text/plain")},
    )
    assert response.status_code == 400


def test_speech_to_text_requires_auth(client):
    response = client.post(
        "/speech-to-text",
        files={"audio": ("test.wav", io.BytesIO(b"\x00" * 64), "audio/wav")},
    )
    assert response.status_code == 401
