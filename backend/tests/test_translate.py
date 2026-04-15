from __future__ import annotations

import pytest


def _payload(*, phrase: str, source_locale: str = "es-ES", target_locale: str = "en-US") -> dict[str, str]:
    return {
        "phrase": phrase,
        "source_locale": source_locale,
        "target_locale": target_locale,
        "source_culture": "spanish",
        "target_culture": "american",
        "workplace_tone": "casual",
    }


def test_translate_success_returns_detected_and_translated(client, auth_headers):
    response = client.post(
        "/translate",
        headers=auth_headers,
        json=_payload(phrase="hola mundo"),
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["literal"].startswith("translated:")
    assert data["cultural"]
    assert data["explanation"]
    assert isinstance(data["tags"], list)
    assert isinstance(data["sentiment_score"], int)
    assert isinstance(data["sentiment_label"], str)


def test_translate_same_language_short_circuit(client, auth_headers):
    response = client.post(
        "/translate",
        headers=auth_headers,
        json=_payload(phrase="hello", source_locale="en-US", target_locale="en-US"),
    )
    assert response.status_code in (200, 400)


def test_translate_empty_text_rejected(client, auth_headers):
    response = client.post("/translate", headers=auth_headers, json=_payload(phrase=""))
    assert response.status_code == 422


def test_translate_text_too_long_rejected(client, auth_headers):
    response = client.post("/translate", headers=auth_headers, json=_payload(phrase="x" * 12000))
    assert response.status_code == 422


def test_translate_unsupported_target_language(client, auth_headers):
    response = client.post(
        "/translate",
        headers=auth_headers,
        json=_payload(phrase="hola", target_locale="xx-invalid"),
    )
    assert response.status_code in (200, 422)


def test_translate_missing_target_language(client, auth_headers):
    payload = _payload(phrase="hola")
    payload.pop("target_locale")
    response = client.post("/translate", headers=auth_headers, json=payload)
    assert response.status_code == 422


def test_translate_requires_auth(client):
    response = client.post("/translate", json=_payload(phrase="hola"))
    assert response.status_code == 401


@pytest.mark.parametrize("target_locale", ["en-US", "fr-FR", "de-DE", "pt-BR"])
def test_translate_multiple_target_languages(client, auth_headers, target_locale):
    response = client.post("/translate", headers=auth_headers, json=_payload(phrase="hola mundo", target_locale=target_locale))
    assert response.status_code == 200
    assert response.json()["data"]["literal"]


def test_translate_rate_limited(client, auth_headers, monkeypatch):
    async def deny(*args, **kwargs):
        from fastapi import HTTPException

        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "slow down"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    response = client.post("/translate", headers=auth_headers, json=_payload(phrase="hola"))
    assert response.status_code == 429


def test_translate_success(client, auth_headers, monkeypatch):
    """Translate endpoint returns literal and cultural adaptation."""

    async def allow(*args, **kwargs):
        return None

    async def fake_translate(_payload):
        return {
            "literal": "Bonjour",
            "cultural": "Salut l'equipe",
            "explanation": "French workplace tone is usually less direct.",
        }

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", allow)
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

    async def allow(*args, **kwargs):
        return None

    async def fake_translate(_payload):
        raise RuntimeError("provider timeout: api key xyz")

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", allow)
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
    assert "fallback" in " ".join(body.get("tags") or []).lower()
