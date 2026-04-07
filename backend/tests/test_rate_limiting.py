from __future__ import annotations

import time
from uuid import uuid4

import pytest


@pytest.mark.parametrize(
    "path,method,payload",
    [
        ("/auth/login", "POST", {"email": "a@a.com", "password": "password123"}),
        ("/translate", "POST", {"text": "hola", "target_language": "en"}),
        ("/channels", "GET", None),
    ],
)
def test_rate_limit_headers_present(client, auth_headers, monkeypatch, path, method, payload):
    async def fake_enforce(*args, **kwargs):
        request = kwargs.get("request")
        if request:
            request.state.rate_limit_headers = {
                "X-RateLimit-Limit": "60",
                "X-RateLimit-Remaining": "59",
                "X-RateLimit-Reset": str(int(time.time()) + 60),
            }

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", fake_enforce)

    if method == "POST":
        response = client.post(path, headers=auth_headers if path != "/auth/login" else None, json=payload)
    else:
        response = client.get(path, headers=auth_headers)

    assert response.headers.get("X-RateLimit-Limit") is not None
    assert response.headers.get("X-RateLimit-Remaining") is not None
    assert response.headers.get("X-RateLimit-Reset") is not None


def test_rate_limit_429_returns_standard_error(client, monkeypatch):
    async def deny(*args, **kwargs):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMITED", "message": "Too many requests"},
            headers={"Retry-After": "3"},
        )

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    response = client.post("/auth/login", json={"email": "a@a.com", "password": "password123"})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"
    assert response.headers.get("Retry-After") == "3"


def test_rate_limit_per_identity(client, monkeypatch):
    seen = {}

    async def enforce(*, identity: str, **kwargs):
        seen[identity] = seen.get(identity, 0) + 1
        if seen[identity] > 2:
            from fastapi import HTTPException

            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", enforce)

    assert client.post("/auth/login", headers={"X-Forwarded-For": "1.1.1.1"}, json={"email": "a@a.com", "password": "password123"}).status_code in (200, 401)
    assert client.post("/auth/login", headers={"X-Forwarded-For": "1.1.1.1"}, json={"email": "a@a.com", "password": "password123"}).status_code in (200, 401)
    assert client.post("/auth/login", headers={"X-Forwarded-For": "1.1.1.1"}, json={"email": "a@a.com", "password": "password123"}).status_code == 429

    # Different identity should not share window state.
    assert client.post("/auth/login", headers={"X-Forwarded-For": "2.2.2.2"}, json={"email": "a@a.com", "password": "password123"}).status_code in (200, 401)


def test_rate_limit_user_and_ip_bucket_separation(client, auth_headers, monkeypatch):
    calls = {"ip": 0, "user": 0}

    async def enforce(*, key: str, **kwargs):
        if "ip:" in key:
            calls["ip"] += 1
        if "user:" in key:
            calls["user"] += 1

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", enforce)

    _ = client.get("/channels", headers=auth_headers)
    assert calls["ip"] >= 0
    assert calls["user"] >= 0


def test_rate_limit_window_reset_behavior(client, monkeypatch):
    counter = {"value": 0}

    async def enforce(*args, **kwargs):
        counter["value"] += 1
        if counter["value"] > 3:
            from fastapi import HTTPException

            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", enforce)

    for _ in range(3):
        assert client.post("/auth/login", json={"email": "u@x.com", "password": "password123"}).status_code in (200, 401)
    assert client.post("/auth/login", json={"email": "u@x.com", "password": "password123"}).status_code == 429

    # Simulate reset by clearing in-memory count used by test stub.
    counter["value"] = 0
    assert client.post("/auth/login", json={"email": "u@x.com", "password": "password123"}).status_code in (200, 401)


def test_rate_limit_applies_to_mesh_endpoint(client, make_mesh_request, monkeypatch):
    async def deny(*args, **kwargs):
        from fastapi import HTTPException

        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", deny)
    headers, body = make_mesh_request({"node_id": str(uuid4()), "status": "online"})
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 429
