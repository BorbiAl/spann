"""Security-focused authentication middleware tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt


def _settings():
    from app.config import settings

    return settings


def _token(*, subject: str, expires_delta_minutes: int, secret: str | None = None) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "email": "tester@example.com",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_delta_minutes)).timestamp()),
    }
    cfg = _settings()
    return jwt.encode(payload, secret or cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def test_protected_route_requires_jwt(client):
    response = client.post(
        "/translate",
        json={
            "phrase": "Hello",
            "source_locale": "en-US",
            "target_locale": "fr-FR",
            "source_culture": "US",
            "target_culture": "FR",
            "workplace_tone": "friendly",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert response.headers.get(_settings().request_id_header)


def test_expired_jwt_is_rejected(client):
    token = _token(subject="11111111-1111-4111-8111-111111111111", expires_delta_minutes=-5)

    response = client.get(
        "/users/me/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_wrong_secret_jwt_is_rejected(client):
    token = _token(
        subject="11111111-1111-4111-8111-111111111111",
        expires_delta_minutes=30,
        secret="wrong-secret-but-long-enough-for-hs256-tests",
    )

    response = client.get(
        "/users/me/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"
