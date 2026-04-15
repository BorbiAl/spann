from __future__ import annotations

import asyncio
import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings


def _build_token(*, user_id: str, workspace_id: str, iat: datetime, exp_minutes: int = 15, include_jti: bool = True, include_workspace: bool = True) -> str:
    payload: dict[str, object] = {
        "sub": user_id,
        "iat": int(iat.timestamp()),
        "exp": int((iat + timedelta(minutes=exp_minutes)).timestamp()),
    }
    if include_jti:
        payload["jti"] = str(uuid4())
    if include_workspace:
        payload["workspace_id"] = workspace_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _mock_login_db(monkeypatch: pytest.MonkeyPatch, *, user_id: str, workspace_id: str) -> dict[str, object]:
    captured: dict[str, object] = {}

    async def fake_authenticate(email: str, password: str) -> dict[str, object]:
        return {
            "user": {"id": user_id, "email": email, "display_name": "Coverage User"},
            "supabase_access_token": "supabase-token",
        }

    async def fake_workspace(_user_id: str) -> str:
        return workspace_id

    async def fake_ensure_workspace_for_user(*, user_id: str, display_name: str | None = None, email: str | None = None) -> str:
        return workspace_id

    async def fake_create_refresh_token(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return {"id": str(uuid4()), **kwargs}

    monkeypatch.setattr("app.routers.auth.db.authenticate_user", fake_authenticate)
    monkeypatch.setattr("app.routers.auth.db.get_default_workspace_for_user", fake_workspace)
    monkeypatch.setattr("app.routers.auth.db.ensure_default_workspace_for_user", fake_ensure_workspace_for_user)
    monkeypatch.setattr("app.routers.auth.db.create_refresh_token", fake_create_refresh_token)
    return captured


def test_token_with_future_iat_rejected(client: pytest.FixtureRequest, test_user: dict[str, str]) -> None:
    token = _build_token(
        user_id=test_user["id"],
        workspace_id=test_user["workspace_id"],
        iat=datetime.now(UTC) + timedelta(hours=1),
    )
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_token_jti_missing_rejected(client: pytest.FixtureRequest, test_user: dict[str, str]) -> None:
    token = _build_token(
        user_id=test_user["id"],
        workspace_id=test_user["workspace_id"],
        iat=datetime.now(UTC),
        include_jti=False,
    )
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401


def test_token_workspace_id_missing_rejected(client: pytest.FixtureRequest, test_user: dict[str, str]) -> None:
    token = _build_token(
        user_id=test_user["id"],
        workspace_id=test_user["workspace_id"],
        iat=datetime.now(UTC),
        include_workspace=False,
    )
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_concurrent_refresh_race_condition(test_app, monkeypatch: pytest.MonkeyPatch) -> None:
    raw = "f" * 128
    old_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    state = {
        old_hash: {
            "user_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "device_hint": "firefox",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "revoked": False,
        }
    }
    lock = asyncio.Lock()

    async def fake_get(token_hash: str):
        return state.get(token_hash)

    async def fake_rotate(**kwargs: object) -> bool:
        old = str(kwargs["old_token_hash"])
        async with lock:
            row = state.get(old)
            if row is None or bool(row["revoked"]):
                return False
            row["revoked"] = True
            new_hash = str(kwargs["new_token_hash"])
            state[new_hash] = {
                "user_id": row["user_id"],
                "workspace_id": row["workspace_id"],
                "device_hint": row["device_hint"],
                "expires_at": str(kwargs["expires_at"]),
                "revoked": False,
            }
            return True

    async def fake_revoke(_token_hash: str) -> None:
        return None

    async def fake_revoke_all(_user_id: str) -> None:
        return None

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.rotate_refresh_token", fake_rotate)
    monkeypatch.setattr("app.routers.auth.db.revoke_refresh_token", fake_revoke)
    monkeypatch.setattr("app.routers.auth.db.revoke_all_refresh_tokens_for_user", fake_revoke_all)

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as ac:
        response_a, response_b = await asyncio.gather(
            ac.post("/auth/refresh", json={"refresh_token": raw}),
            ac.post("/auth/refresh", json={"refresh_token": raw}),
        )

    statuses = sorted([response_a.status_code, response_b.status_code])
    assert statuses == [200, 401]


def test_magic_link_sends_email(client, monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, str] = {}

    async def fake_send_magic_link(email: str) -> None:
        sent["email"] = email

    monkeypatch.setattr("app.routers.auth.db.send_magic_link", fake_send_magic_link)

    response = client.post("/auth/magic-link", json={"email": "test@spann.app"})
    assert response.status_code == 200
    assert sent["email"] == "test@spann.app"


def test_magic_link_invalid_email(client) -> None:
    response = client.post("/auth/magic-link", json={"email": "not-an-email"})
    assert response.status_code == 422


def test_magic_link_rate_limited(client, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    async def enforce(*, identity: str, bucket: str, limit: int, request=None, window_seconds: int = 60):
        calls["n"] += 1
        if calls["n"] > 10:
            from fastapi import HTTPException

            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", enforce)

    status_codes = [client.post("/auth/magic-link", json={"email": "test@spann.app"}).status_code for _ in range(11)]
    assert status_codes[-1] == 429


def test_register_email_not_confirmed_maps_to_conflict(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_register_user(**kwargs: object):
        raise RuntimeError("Email not confirmed")

    monkeypatch.setattr("app.routers.auth.db.register_user", fake_register_user)

    response = client.post(
        "/auth/register",
        json={
            "email": "user@spann.app",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "name": "User",
        },
    )

    body = response.json()
    assert response.status_code == 409
    assert body["error"]["code"] == "email_not_confirmed"


def test_login_device_hint_stored(client, monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))

    response = client.post("/auth/login", json={"email": "user@spann.app", "password": "password123", "device_hint": "iphone"})
    assert response.status_code == 200
    assert captured.get("device_hint") == "iphone"


def test_all_user_sessions_revoked_on_reuse(client, monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = str(uuid4())
    raw = "a" * 128
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    sessions = [
        {"user_id": user_id, "revoked": False},
        {"user_id": user_id, "revoked": False},
        {"user_id": user_id, "revoked": False},
        {"user_id": str(uuid4()), "revoked": False},
    ]

    async def fake_get(_hash: str):
        return {
            "user_id": user_id,
            "workspace_id": str(uuid4()),
            "device_hint": "chrome",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "revoked": True,
            "token_hash": token_hash,
        }

    async def fake_revoke_all(target_user: str) -> None:
        for item in sessions:
            if item["user_id"] == target_user:
                item["revoked"] = True

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.revoke_all_refresh_tokens_for_user", fake_revoke_all)

    response = client.post("/auth/refresh", json={"refresh_token": raw})
    assert response.status_code == 401

    revoked_count = sum(1 for item in sessions if item["user_id"] == user_id and item["revoked"])
    assert revoked_count == 3


def test_refresh_token_hash_algorithm(client, monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))

    response = client.post("/auth/login", json={"email": "user@spann.app", "password": "password123"})
    assert response.status_code == 200

    raw_refresh = response.json()["data"]["refresh_token"]
    stored_hash = str(captured["token_hash"])
    assert stored_hash == hashlib.sha256(raw_refresh.encode("utf-8")).hexdigest()
    assert stored_hash != hashlib.md5(raw_refresh.encode("utf-8")).hexdigest()  # nosec B324
    assert stored_hash != raw_refresh


def test_login_without_workspace_membership_bootstraps_workspace(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_authenticate(email: str, password: str) -> dict[str, object]:
        return {
            "user": {"id": str(uuid4()), "email": email, "display_name": "No Workspace"},
            "supabase_access_token": "supabase-token",
        }

    async def fake_workspace(_user_id: str):
        return None

    async def fake_ensure_workspace_for_user(*, user_id: str, display_name: str | None = None, email: str | None = None):
        return str(uuid4())

    async def fake_create_refresh_token(**kwargs: object) -> dict[str, object]:
        return {"id": str(uuid4()), **kwargs}

    monkeypatch.setattr("app.routers.auth.db.authenticate_user", fake_authenticate)
    monkeypatch.setattr("app.routers.auth.db.get_default_workspace_for_user", fake_workspace)
    monkeypatch.setattr("app.routers.auth.db.ensure_default_workspace_for_user", fake_ensure_workspace_for_user)
    monkeypatch.setattr("app.routers.auth.db.create_refresh_token", fake_create_refresh_token)

    response = client.post("/auth/login", json={"email": "user@spann.app", "password": "password123"})
    assert response.status_code == 200


def test_refresh_invalid_token_not_found(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get(_token_hash: str):
        return None

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    response = client.post("/auth/refresh", json={"refresh_token": "b" * 128})
    assert response.status_code == 401


def test_login_invalid_credentials_branch(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_authenticate(email: str, password: str):
        return None

    monkeypatch.setattr("app.routers.auth.db.authenticate_user", fake_authenticate)
    response = client.post("/auth/login", json={"email": "user@spann.app", "password": "password123"})
    assert response.status_code == 401


def test_refresh_token_with_non_string_expiry_rejected(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get(_token_hash: str):
        return {
            "user_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "expires_at": 12345,
            "revoked": False,
        }

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    response = client.post("/auth/refresh", json={"refresh_token": "c" * 128})
    assert response.status_code == 401


def test_refresh_rotation_failed_returns_401(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get(_token_hash: str):
        return {
            "user_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "device_hint": "web",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "revoked": False,
        }

    async def fake_rotate(**kwargs: object) -> bool:
        return False

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.rotate_refresh_token", fake_rotate)

    response = client.post("/auth/refresh", json={"refresh_token": "d" * 128})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "refresh_rotation_failed"


def test_refresh_expired_token_branch(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def allow(**kwargs: object) -> None:
        return None

    async def fake_get(_token_hash: str):
        return {
            "user_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "expires_at": (datetime.now(UTC) - timedelta(days=1)).isoformat(),
            "revoked": False,
        }

    called = {"revoked": False}

    async def fake_revoke(_token_hash: str) -> None:
        called["revoked"] = True

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", allow)
    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.revoke_refresh_token", fake_revoke)

    response = client.post("/auth/refresh", json={"refresh_token": "d" * 128})
    assert response.status_code == 401
    assert called["revoked"] is True


def test_logout_unknown_token_returns_revoked_false(client, monkeypatch: pytest.MonkeyPatch, test_user: dict[str, str]) -> None:
    async def fake_get(_token_hash: str):
        return None

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json={"refresh_token": "e" * 128},
    )

    assert response.status_code == 200
    assert response.json()["data"]["revoked"] is False


def test_logout_foreign_token_forbidden(client, monkeypatch: pytest.MonkeyPatch, test_user: dict[str, str]) -> None:
    async def fake_get(_token_hash: str):
        return {
            "user_id": str(uuid4()),
            "workspace_id": test_user["workspace_id"],
            "revoked": False,
        }

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)

    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json={"refresh_token": "f" * 128},
    )

    assert response.status_code == 403


def test_logout_valid_token_revoked_true(client, monkeypatch: pytest.MonkeyPatch, test_user: dict[str, str]) -> None:
    called = {"revoked": False}

    async def fake_get(_token_hash: str):
        return {
            "user_id": test_user["id"],
            "workspace_id": test_user["workspace_id"],
            "revoked": False,
        }

    async def fake_revoke(_token_hash: str) -> None:
        called["revoked"] = True

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.revoke_refresh_token", fake_revoke)

    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json={"refresh_token": "g" * 128},
    )

    assert response.status_code == 200
    assert response.json()["data"]["revoked"] is True
    assert called["revoked"] is True
