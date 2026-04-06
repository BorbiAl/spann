"""Tests for translation endpoint."""

from __future__ import annotations


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
