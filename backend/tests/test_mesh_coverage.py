from __future__ import annotations

import hashlib
import hmac
import inspect
import json
import secrets
import time
from typing import Any
from uuid import uuid4

import pytest

from app.routers import mesh as mesh_router


class _FakeNonceCache:
    def __init__(self, now_provider):
        self._store: dict[str, tuple[str, int]] = {}
        self._now = now_provider

    async def get(self, key: str) -> str | None:
        now = int(self._now())
        item = self._store.get(key)
        if item is None:
            return None
        value, expires_at = item
        if now >= expires_at:
            self._store.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: str, ex: int) -> None:
        self._store[key] = (value, int(self._now()) + ex)

    async def aclose(self) -> None:
        return None


def _sign_sync_payload(*, node_id: str, secret: str, payload: dict[str, Any], timestamp: int | None = None, nonce: str | None = None) -> tuple[dict[str, str], str]:
    ts = str(timestamp if timestamp is not None else int(time.time()))
    nonce_value = nonce or secrets.token_hex(8)
    body = json.dumps(payload).encode("utf-8")
    body_hash = hashlib.sha256(body).hexdigest()
    signing_input = f"{node_id}:{ts}:{nonce_value}:{body_hash}"
    signature = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Mesh-Node-ID": node_id,
        "X-Mesh-Timestamp": ts,
        "X-Mesh-Nonce": nonce_value,
        "X-Mesh-Signature": signature,
    }
    return headers, body.decode("utf-8")


def test_node_registration_stores_hash_not_secret(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def fake_verify_workspace_access(**kwargs: Any) -> bool:
        return True

    async def fake_create_mesh_node(*, workspace_id: str, node_id: str, secret_hash: str) -> dict[str, str]:
        captured["workspace_id"] = workspace_id
        captured["node_id"] = node_id
        captured["secret_hash"] = secret_hash
        return {"node_id": node_id, "workspace_id": workspace_id}

    monkeypatch.setattr("app.routers.mesh.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.mesh.db.create_mesh_node", fake_create_mesh_node)

    response = client.post("/mesh/register", headers=auth_headers, json={"node_name": "Relay One"})
    assert response.status_code == 201

    node_secret = response.json()["data"]["node_secret"]
    assert node_secret
    assert captured["secret_hash"] != node_secret


def test_node_registration_workspace_isolation(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_verify_workspace_access(**kwargs: Any) -> bool:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "forbidden"})

    monkeypatch.setattr("app.routers.mesh.db.verify_workspace_access", fake_verify_workspace_access)

    response = client.post("/mesh/register", headers=auth_headers, json={"node_name": "Relay One"})
    assert response.status_code == 403


def test_sync_valid_request_updates_last_seen(client, monkeypatch: pytest.MonkeyPatch) -> None:
    node_id = "node-test-1"
    secret = "mesh-secret-key"
    calls = {"last_seen": 0}

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    async def fake_update_last_seen(_node_id: str) -> None:
        calls["last_seen"] += 1

    async def fake_sync(messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        return len(messages)

    cache = _FakeNonceCache(time.time)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.update_mesh_node_last_seen", fake_update_last_seen)
    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": [{"id": str(uuid4()), "channelId": str(uuid4()), "userId": str(uuid4()), "text": "hello"}]}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload)

    response = client.post("/mesh/sync", headers=headers, content=body)
    assert response.status_code == 201
    assert calls["last_seen"] == 1


def test_sync_timestamp_boundary_exactly_300s(client, monkeypatch: pytest.MonkeyPatch) -> None:
    now = int(time.time())
    node_id = "node-test-2"
    secret = "mesh-secret-key"

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    async def fake_sync(messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        return len(messages)

    cache = _FakeNonceCache(lambda: now)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.time.time", lambda: now)
    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": []}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload, timestamp=now - 300)

    response = client.post("/mesh/sync", headers=headers, content=body)
    assert response.status_code == 201


def test_sync_timestamp_boundary_301s(client, monkeypatch: pytest.MonkeyPatch) -> None:
    now = int(time.time())
    node_id = "node-test-3"
    secret = "mesh-secret-key"

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    cache = _FakeNonceCache(lambda: now)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.time.time", lambda: now)
    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": []}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload, timestamp=now - 301)

    response = client.post("/mesh/sync", headers=headers, content=body)
    assert response.status_code == 401


def test_sync_body_hash_mismatch(client, monkeypatch: pytest.MonkeyPatch) -> None:
    node_id = "node-test-4"
    secret = "mesh-secret-key"

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    async def fake_sync(messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        return len(messages)

    cache = _FakeNonceCache(time.time)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": [{"id": str(uuid4()), "channelId": str(uuid4()), "userId": str(uuid4()), "text": "one"}]}
    headers, _body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload)

    tampered_body = json.dumps({"messages": [{"id": str(uuid4()), "channelId": str(uuid4()), "userId": str(uuid4()), "text": "two"}]})
    response = client.post("/mesh/sync", headers=headers, content=tampered_body)
    assert response.status_code == 401


def test_sync_empty_messages_array(client, monkeypatch: pytest.MonkeyPatch) -> None:
    node_id = "node-test-5"
    secret = "mesh-secret-key"

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    async def fake_sync(messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        return len(messages)

    cache = _FakeNonceCache(time.time)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": []}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload)

    response = client.post("/mesh/sync", headers=headers, content=body)
    assert response.status_code == 201
    assert response.json()["data"]["synced"] == 0


def test_sync_stores_messages_in_db(client, monkeypatch: pytest.MonkeyPatch) -> None:
    node_id = "node-test-6"
    secret = "mesh-secret-key"
    captured: dict[str, object] = {}

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": "ws-1", "secret_hash": secret, "revoked": False}

    async def fake_sync(messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        captured["messages"] = messages
        captured["workspace_id"] = workspace_id
        captured["source_node_id"] = source_node_id
        return len(messages)

    cache = _FakeNonceCache(time.time)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": [{"id": "m1", "channelId": "c1", "userId": "u1", "text": "from mesh"}]}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload)

    response = client.post("/mesh/sync", headers=headers, content=body)
    assert response.status_code == 201
    assert captured["workspace_id"] == "ws-1"
    assert captured["source_node_id"] == node_id
    assert len(captured["messages"]) == 1


def test_revoke_node_endpoint(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    state = {"revoked": False}
    node_id = "node-revoke-1"
    secret = "mesh-secret-key"

    async def fake_verify_workspace_access(**kwargs: Any) -> bool:
        return True

    async def fake_revoke_mesh_node(*, node_id: str, workspace_id: str) -> bool:
        state["revoked"] = True
        return True

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {
            "node_id": node_id,
            "workspace_id": str(uuid4()),
            "secret_hash": secret,
            "revoked": state["revoked"],
        }

    cache = _FakeNonceCache(time.time)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.mesh.db.revoke_mesh_node", fake_revoke_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    revoke_response = client.post(f"/mesh/nodes/{node_id}/revoke", headers=auth_headers)
    assert revoke_response.status_code == 200

    payload = {"messages": []}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload)
    sync_response = client.post("/mesh/sync", headers=headers, content=body)
    assert sync_response.status_code == 401


def test_list_nodes_workspace_isolation(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_verify_workspace_access(**kwargs: Any) -> bool:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "forbidden"})

    monkeypatch.setattr("app.routers.mesh.db.verify_workspace_access", fake_verify_workspace_access)

    response = client.get("/mesh/nodes", headers=auth_headers)
    assert response.status_code == 403


def test_nonce_ttl_expiry(client, monkeypatch: pytest.MonkeyPatch) -> None:
    current_time = {"value": int(time.time())}
    node_id = "node-ttl-1"
    secret = "mesh-secret-key"

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    async def fake_sync(messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        return len(messages)

    cache = _FakeNonceCache(lambda: current_time["value"])

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.time.time", lambda: current_time["value"])
    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": []}
    headers, body = _sign_sync_payload(
        node_id=node_id,
        secret=secret,
        payload=payload,
        timestamp=current_time["value"],
        nonce="fixed-nonce",
    )

    first = client.post("/mesh/sync", headers=headers, content=body)
    second = client.post("/mesh/sync", headers=headers, content=body)

    current_time["value"] += 601
    headers_after_ttl, body_after_ttl = _sign_sync_payload(
        node_id=node_id,
        secret=secret,
        payload=payload,
        timestamp=current_time["value"],
        nonce="fixed-nonce",
    )
    third = client.post("/mesh/sync", headers=headers_after_ttl, content=body_after_ttl)

    assert first.status_code == 201
    assert second.status_code == 401
    assert third.status_code == 201


def test_hmac_constant_time_comparison(client, monkeypatch: pytest.MonkeyPatch) -> None:
    source = inspect.getsource(mesh_router.verify_mesh_node)
    assert "hmac.compare_digest" in source


def test_sync_invalid_timestamp_header(client, monkeypatch: pytest.MonkeyPatch) -> None:
    node_id = "node-bad-ts"
    secret = "mesh-secret-key"

    async def fake_get_mesh_node(_node_id: str) -> dict[str, object]:
        return {"node_id": node_id, "workspace_id": str(uuid4()), "secret_hash": secret, "revoked": False}

    cache = _FakeNonceCache(time.time)

    async def fake_nonce_cache() -> _FakeNonceCache:
        return cache

    monkeypatch.setattr("app.routers.mesh.db.get_mesh_node", fake_get_mesh_node)
    monkeypatch.setattr("app.routers.mesh._nonce_cache", fake_nonce_cache)

    payload = {"messages": []}
    headers, body = _sign_sync_payload(node_id=node_id, secret=secret, payload=payload)
    headers["X-Mesh-Timestamp"] = "not-a-number"

    response = client.post("/mesh/sync", headers=headers, content=body)
    assert response.status_code == 401


def test_sync_missing_headers_rejected(client) -> None:
    response = client.post("/mesh/sync", json={"messages": []})
    assert response.status_code == 401


def test_register_requires_workspace_claim(client, issue_access_token, monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = str(uuid4())
    token = issue_access_token(user_id, str(uuid4()), extra={"workspace_id": "   "})

    response = client.post("/mesh/register", headers={"Authorization": f"Bearer {token}"}, json={"node_name": "relay"})
    assert response.status_code == 403


def test_list_nodes_requires_workspace_claim(client, issue_access_token) -> None:
    user_id = str(uuid4())
    token = issue_access_token(user_id, str(uuid4()), extra={"workspace_id": "   "})

    response = client.get("/mesh/nodes", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_list_nodes_success(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_verify_workspace_access(**kwargs: Any) -> bool:
        return True

    async def fake_list_mesh_nodes(*, workspace_id: str) -> list[dict[str, object]]:
        return [{"node_id": "node-1", "workspace_id": workspace_id, "revoked": False}]

    monkeypatch.setattr("app.routers.mesh.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.mesh.db.list_mesh_nodes", fake_list_mesh_nodes)

    response = client.get("/mesh/nodes", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"][0]["node_id"] == "node-1"


def test_revoke_requires_workspace_claim(client, issue_access_token) -> None:
    user_id = str(uuid4())
    token = issue_access_token(user_id, str(uuid4()), extra={"workspace_id": "   "})

    response = client.post("/mesh/nodes/node-a/revoke", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_revoke_node_not_found(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_verify_workspace_access(**kwargs: Any) -> bool:
        return True

    async def fake_revoke_mesh_node(*, node_id: str, workspace_id: str) -> bool:
        return False

    monkeypatch.setattr("app.routers.mesh.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.mesh.db.revoke_mesh_node", fake_revoke_mesh_node)

    response = client.post("/mesh/nodes/missing-node/revoke", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_nonce_cache_factory_returns_client() -> None:
    cache = await mesh_router._nonce_cache()
    assert cache is not None
    await cache.aclose()
