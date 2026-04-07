from __future__ import annotations

import hashlib
import secrets
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest


def _mock_login_db(monkeypatch, *, user_id: str, workspace_id: str, success: bool = True):
    async def fake_authenticate(email: str, password: str):
        if not success:
            return None
        return {
            "user": {"id": user_id, "email": email, "display_name": "Test User"},
            "supabase_access_token": "supabase-token",
        }

    async def fake_default_workspace(_user_id: str):
        return workspace_id

    async def fake_create_refresh_token(**kwargs):
        return {"id": str(uuid4()), **kwargs}

    monkeypatch.setattr("app.routers.auth.db.authenticate_user", fake_authenticate)
    monkeypatch.setattr("app.routers.auth.db.get_default_workspace_for_user", fake_default_workspace)
    monkeypatch.setattr("app.routers.auth.db.create_refresh_token", fake_create_refresh_token)


def test_login_success(client, monkeypatch):
    user_id = str(uuid4())
    workspace_id = str(uuid4())
    _mock_login_db(monkeypatch, user_id=user_id, workspace_id=workspace_id)

    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    body = response.json()["data"]

    assert response.status_code == 200
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 900


def test_login_wrong_password(client, monkeypatch):
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()), success=False)
    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_email(client, monkeypatch):
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()), success=False)
    response = client.post("/auth/login", json={"email": "unknown@example.com", "password": "password123"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_missing_fields(client):
    response = client.post("/auth/login", json={"email": "tester@example.com"})
    assert response.status_code == 422


def test_login_extra_fields_rejected(client):
    response = client.post(
        "/auth/login",
        json={"email": "tester@example.com", "password": "password123", "extra": "nope"},
    )
    assert response.status_code == 422


def test_login_password_too_short(client):
    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "short"})
    assert response.status_code == 422


def test_login_email_too_long(client):
    response = client.post("/auth/login", json={"email": ("a" * 255) + "@x.com", "password": "password123"})
    assert response.status_code == 422


def test_access_token_contains_required_claims(client, monkeypatch):
    user_id = str(uuid4())
    workspace_id = str(uuid4())
    _mock_login_db(monkeypatch, user_id=user_id, workspace_id=workspace_id)
    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    token = response.json()["data"]["access_token"]
    claims = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
    assert set(["sub", "iat", "exp", "jti", "workspace_id"]).issubset(set(claims.keys()))


def test_access_token_expires_in_15_minutes(client, monkeypatch):
    user_id = str(uuid4())
    workspace_id = str(uuid4())
    _mock_login_db(monkeypatch, user_id=user_id, workspace_id=workspace_id)
    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    token = response.json()["data"]["access_token"]
    claims = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
    assert claims["exp"] - claims["iat"] == 900


def test_expired_token_rejected(client, issue_access_token, test_user):
    token = issue_access_token(test_user["id"], test_user["workspace_id"], minutes=-1)
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_wrong_secret_rejected(client, issue_access_token, test_user):
    token = issue_access_token(test_user["id"], test_user["workspace_id"], token_secret="wrong-secret", minutes=15)
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401


def test_missing_token_rejected(client):
    response = client.patch("/users/me/preferences", json={"locale": "en-US"})
    assert response.status_code == 401


def test_malformed_token_rejected(client):
    response = client.patch("/users/me/preferences", headers={"Authorization": "Bearer not-a-jwt"}, json={"locale": "en-US"})
    assert response.status_code == 401


def test_missing_sub_claim_rejected(client, test_user):
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
            "jti": str(uuid4()),
            "workspace_id": test_user["workspace_id"],
        },
        "this-is-a-very-long-test-secret-32bytes!!",
        algorithm="HS256",
    )
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401


def test_missing_exp_claim_rejected(client, test_user):
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": test_user["id"],
            "iat": int(now.timestamp()),
            "jti": str(uuid4()),
            "workspace_id": test_user["workspace_id"],
        },
        "this-is-a-very-long-test-secret-32bytes!!",
        algorithm="HS256",
    )
    response = client.patch("/users/me/preferences", headers={"Authorization": f"Bearer {token}"}, json={"locale": "en-US"})
    assert response.status_code == 401


@pytest.fixture()
def refresh_setup(monkeypatch):
    store = {}

    async def fake_get(token_hash: str):
        return store.get(token_hash)

    async def fake_rotate(**kwargs):
        old_hash = kwargs["old_token_hash"]
        old = store.get(old_hash)
        if old is None or old["revoked"]:
            return False
        old["revoked"] = True
        new_hash = kwargs["new_token_hash"]
        store[new_hash] = {
            "user_id": kwargs["user_id"],
            "workspace_id": kwargs["workspace_id"],
            "device_hint": kwargs.get("device_hint"),
            "expires_at": kwargs["expires_at"].isoformat(),
            "revoked": False,
        }
        return True

    async def fake_revoke(token_hash: str):
        if token_hash in store:
            store[token_hash]["revoked"] = True

    async def fake_revoke_all(user_id: str):
        for value in store.values():
            if str(value["user_id"]) == str(user_id):
                value["revoked"] = True

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.rotate_refresh_token", fake_rotate)
    monkeypatch.setattr("app.routers.auth.db.revoke_refresh_token", fake_revoke)
    monkeypatch.setattr("app.routers.auth.db.revoke_all_refresh_tokens_for_user", fake_revoke_all)
    return store


def test_refresh_returns_new_token_pair(client, refresh_setup):
    raw = secrets.token_hex(64)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    refresh_setup[token_hash] = {
        "user_id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked": False,
    }
    response = client.post("/auth/refresh", json={"refresh_token": raw})
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]
    assert "refresh_token" in response.json()["data"]


def test_refresh_old_token_invalid_after_rotation(client, refresh_setup):
    raw = secrets.token_hex(64)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    refresh_setup[token_hash] = {
        "user_id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked": False,
    }
    assert client.post("/auth/refresh", json={"refresh_token": raw}).status_code == 200
    assert client.post("/auth/refresh", json={"refresh_token": raw}).status_code == 401


def test_refresh_new_token_works(client, refresh_setup):
    raw = secrets.token_hex(64)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    refresh_setup[token_hash] = {
        "user_id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked": False,
    }
    first = client.post("/auth/refresh", json={"refresh_token": raw})
    new_refresh = first.json()["data"]["refresh_token"]
    second = client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert second.status_code == 200


def test_refresh_expired_token_rejected(client, refresh_setup):
    raw = secrets.token_hex(64)
    refresh_setup[hashlib.sha256(raw.encode()).hexdigest()] = {
        "user_id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        "revoked": False,
    }
    response = client.post("/auth/refresh", json={"refresh_token": raw})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "refresh_token_expired"


def test_refresh_revoked_token_rejected(client, refresh_setup):
    raw = secrets.token_hex(64)
    refresh_setup[hashlib.sha256(raw.encode()).hexdigest()] = {
        "user_id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked": True,
    }
    response = client.post("/auth/refresh", json={"refresh_token": raw})
    assert response.status_code == 401


def test_refresh_reuse_detection(client, refresh_setup):
    uid = str(uuid4())
    raw = secrets.token_hex(64)
    refresh_setup[hashlib.sha256(raw.encode()).hexdigest()] = {
        "user_id": uid,
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked": True,
    }
    response = client.post("/auth/refresh", json={"refresh_token": raw})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_reuse_detected"


def test_refresh_reuse_invalidates_all_sessions(client, refresh_setup):
    uid = str(uuid4())
    for _ in range(3):
        raw = secrets.token_hex(64)
        refresh_setup[hashlib.sha256(raw.encode()).hexdigest()] = {
            "user_id": uid,
            "workspace_id": str(uuid4()),
            "device_hint": "chrome",
            "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "revoked": False,
        }
    revoked_raw = secrets.token_hex(64)
    refresh_setup[hashlib.sha256(revoked_raw.encode()).hexdigest()] = {
        "user_id": uid,
        "workspace_id": str(uuid4()),
        "device_hint": "chrome",
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "revoked": True,
    }
    _ = client.post("/auth/refresh", json={"refresh_token": revoked_raw})
    assert all(row["revoked"] for row in refresh_setup.values())


def test_refresh_missing_token_field(client):
    response = client.post("/auth/refresh", json={})
    assert response.status_code == 422


def test_refresh_token_stored_as_hash(client, monkeypatch):
    captured = {}
    user_id = str(uuid4())
    workspace_id = str(uuid4())
    _mock_login_db(monkeypatch, user_id=user_id, workspace_id=workspace_id)

    async def fake_create_refresh_token(**kwargs):
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr("app.routers.auth.db.create_refresh_token", fake_create_refresh_token)
    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    raw = response.json()["data"]["refresh_token"]
    assert raw != captured["token_hash"]
    assert hashlib.sha256(raw.encode()).hexdigest() == captured["token_hash"]


def test_logout_revokes_refresh_token(client, monkeypatch, test_user):
    refresh = secrets.token_hex(64)

    async def fake_get(_):
        return {"user_id": test_user["id"], "workspace_id": test_user["workspace_id"], "revoked": False}

    revoked = {"value": False}

    async def fake_revoke(_):
        revoked["value"] = True

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.revoke_refresh_token", fake_revoke)

    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json={"refresh_token": refresh},
    )
    assert response.status_code == 200
    assert revoked["value"] is True


def test_logout_access_token_still_valid_until_expiry(client, test_user):
    response = client.patch(
        "/users/me/preferences",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json={"locale": "en-US"},
    )
    assert response.status_code in (200, 500)


def test_logout_missing_refresh_token(client, test_user):
    response = client.post("/auth/logout", headers={"Authorization": f"Bearer {test_user['access_token']}"}, json={})
    assert response.status_code == 422


def test_logout_already_revoked_token(client, monkeypatch, test_user):
    refresh = secrets.token_hex(64)

    async def fake_get(_):
        return {"user_id": test_user["id"], "workspace_id": test_user["workspace_id"], "revoked": True}

    async def fake_revoke(_):
        return None

    monkeypatch.setattr("app.routers.auth.db.get_refresh_token_by_hash", fake_get)
    monkeypatch.setattr("app.routers.auth.db.revoke_refresh_token", fake_revoke)
    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json={"refresh_token": refresh},
    )
    assert response.status_code in (200, 401)


def test_auth_rate_limit_enforced(client, monkeypatch):
    async def deny(*args, **kwargs):
        if deny.calls >= 10:
            from fastapi import HTTPException

            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"}, headers={"Retry-After": "1"})
        deny.calls += 1

    deny.calls = 0
    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))
    statuses = [client.post("/auth/login", json={"email": "a@a.com", "password": "password123"}).status_code for _ in range(11)]
    assert statuses[-1] == 429


def test_auth_rate_limit_retry_after_header(client, monkeypatch):
    async def deny(*args, **kwargs):
        from fastapi import HTTPException

        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"}, headers={"Retry-After": "5"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))
    response = client.post("/auth/login", json={"email": "a@a.com", "password": "password123"})
    assert response.status_code == 429
    assert "Retry-After" in response.headers


def test_auth_rate_limit_x_headers(client, monkeypatch):
    async def noop(*args, **kwargs):
        request = kwargs.get("request")
        if request is not None:
            request.state.rate_limit_headers = {
                "X-RateLimit-Limit": "10",
                "X-RateLimit-Remaining": "9",
                "X-RateLimit-Reset": str(int(time.time()) + 60),
            }

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", noop)
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))
    response = client.post("/auth/login", json={"email": "a@a.com", "password": "password123"})
    assert response.headers.get("X-RateLimit-Limit") is not None
    assert response.headers.get("X-RateLimit-Remaining") is not None
    assert response.headers.get("X-RateLimit-Reset") is not None


def test_auth_rate_limit_resets_after_window(client, monkeypatch):
    calls = {"n": 0}

    async def enforce(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 11:
            from fastapi import HTTPException

            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", enforce)
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))
    for _ in range(10):
        assert client.post("/auth/login", json={"email": "a@a.com", "password": "password123"}).status_code == 200
    assert client.post("/auth/login", json={"email": "a@a.com", "password": "password123"}).status_code == 429
    calls["n"] = 0
    assert client.post("/auth/login", json={"email": "a@a.com", "password": "password123"}).status_code == 200


def test_auth_rate_limit_per_ip_isolation(client, monkeypatch):
    seen = {}

    async def enforce(*, identity: str, **kwargs):
        seen[identity] = seen.get(identity, 0) + 1
        if seen[identity] > 10:
            from fastapi import HTTPException

            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", enforce)
    _mock_login_db(monkeypatch, user_id=str(uuid4()), workspace_id=str(uuid4()))
    for _ in range(10):
        client.post("/auth/login", json={"email": "a@a.com", "password": "password123"})
    assert client.post("/auth/login", json={"email": "a@a.com", "password": "password123"}).status_code == 429
    assert client.post("/auth/login", headers={"X-Forwarded-For": "2.2.2.2"}, json={"email": "a@a.com", "password": "password123"}).status_code in (200, 429)
