from __future__ import annotations

import pytest


def test_translate_success_returns_detected_and_translated(client, auth_headers):
    response = client.post(
        "/translate",
        headers=auth_headers,
        json={"text": "hola mundo", "target_language": "en"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["translated_text"] == "hello world"
    assert data["detected_language"] == "es"
    assert data["target_language"] == "en"


def test_translate_same_language_short_circuit(client, auth_headers):
    response = client.post(
        "/translate",
        headers=auth_headers,
        json={"text": "hello", "source_language": "en", "target_language": "en"},
    )
    assert response.status_code in (200, 400)


def test_translate_empty_text_rejected(client, auth_headers):
    response = client.post("/translate", headers=auth_headers, json={"text": "", "target_language": "en"})
    assert response.status_code == 422


def test_translate_text_too_long_rejected(client, auth_headers):
    response = client.post("/translate", headers=auth_headers, json={"text": "x" * 12000, "target_language": "en"})
    assert response.status_code in (400, 422)


def test_translate_unsupported_target_language(client, auth_headers):
    response = client.post(
        "/translate",
        headers=auth_headers,
        json={"text": "hola", "target_language": "xx-invalid"},
    )
    assert response.status_code in (400, 422)


def test_translate_missing_target_language(client, auth_headers):
    response = client.post("/translate", headers=auth_headers, json={"text": "hola"})
    assert response.status_code == 422


def test_translate_requires_auth(client):
    response = client.post("/translate", json={"text": "hola", "target_language": "en"})
    assert response.status_code == 401


@pytest.mark.parametrize("target", ["en", "fr", "de", "pt"])
def test_translate_multiple_target_languages(client, auth_headers, target):
    response = client.post("/translate", headers=auth_headers, json={"text": "hola mundo", "target_language": target})
    assert response.status_code == 200
    assert response.json()["data"]["target_language"] == target


def test_translate_rate_limited(client, auth_headers, monkeypatch):
    async def deny(*args, **kwargs):
        from fastapi import HTTPException

        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "slow down"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    response = client.post("/translate", headers=auth_headers, json={"text": "hola", "target_language": "en"})
    assert response.status_code == 429


class _NoopRateLimiter:
    async def enforce(self, **kwargs):
        return None


def test_translate_success(client, auth_headers, monkeypatch):
    """Translate endpoint returns literal and cultural adaptation."""

    async def fake_translate(_payload):
        return {
            "literal": "Bonjour",
            "cultural": "Salut l'equipe",
            "explanation": "French workplace tone is usually less direct.",
        }

    monkeypatch.setattr("app.routers.translate.rate_limiter", _NoopRateLimiter())
    monkeypatch.setattr("app.routers.translate.translate_culturally", fake_translate)

    response = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": "Hello team",
            "source_locale": "en-US",
            "target_locale": "fr-FR",
            "source_culture": "US",
            "target_culture": "FR",
            "workplace_tone": "friendly",
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["literal"] == "Bonjour"


def test_translate_error_fails_open(client, auth_headers, monkeypatch):
    """Translation provider failures should return original phrase as safe fallback."""

    async def fake_translate(_payload):
        raise RuntimeError("provider timeout: api key xyz")

    monkeypatch.setattr("app.routers.translate.rate_limiter", _NoopRateLimiter())
    monkeypatch.setattr("app.routers.translate.translate_culturally", fake_translate)

    response = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": "Hello team",
            "source_locale": "en-US",
            "target_locale": "fr-FR",
            "source_culture": "US",
            "target_culture": "FR",
            "workplace_tone": "friendly",
        },
    )

    body = response.json()["data"]
    assert response.status_code == 200
    assert body["literal"] == "Hello team"
    assert body["cultural"] == "Hello team"
    assert "fallback" in body["explanation"].lower()
