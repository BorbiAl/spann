from __future__ import annotations

import json
import time
from uuid import uuid4


def test_mesh_valid_hmac_request(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload)
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 401


def test_mesh_invalid_signature(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload)
    headers["X-Mesh-Signature"] = "bad-signature"
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 401


def test_mesh_missing_signature_header(client):
    payload = {"node_id": str(uuid4()), "status": "online"}
    body = json.dumps(payload)
    response = client.post("/mesh/presence", headers={"Content-Type": "application/json"}, content=body)
    assert response.status_code == 401


def test_mesh_missing_timestamp_header(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload)
    headers.pop("X-Mesh-Timestamp", None)
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 401


def test_mesh_stale_timestamp_rejected(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload, timestamp=int(time.time()) - 1000)
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 401


def test_mesh_future_timestamp_rejected(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload, timestamp=int(time.time()) + 1000)
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 401


def test_mesh_replay_nonce_rejected(client, make_mesh_request):
    nonce = "shared-nonce"
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload, nonce=nonce)
    first = client.post("/mesh/presence", headers=headers, content=body)
    second_headers, second_body = make_mesh_request(payload, nonce=nonce)
    second = client.post("/mesh/presence", headers=second_headers, content=second_body)
    assert first.status_code == 401
    assert second.status_code == 401


def test_mesh_payload_hash_mismatch_rejected(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload)
    tampered = json.dumps({"node_id": payload["node_id"], "status": "offline"})
    response = client.post("/mesh/presence", headers=headers, content=tampered)
    assert response.status_code == 401


def test_mesh_invalid_content_type_rejected(client, make_mesh_request):
    payload = {"node_id": str(uuid4()), "status": "online"}
    headers, body = make_mesh_request(payload)
    headers["Content-Type"] = "text/plain"
    response = client.post("/mesh/presence", headers=headers, content=body)
    assert response.status_code == 401


def test_mesh_bad_json_rejected(client, make_mesh_request):
    raw = "{bad-json"
    headers, _ = make_mesh_request({})
    headers["X-Mesh-Body-Sha256"] = "0" * 64
    response = client.post("/mesh/presence", headers=headers, content=raw)
    assert response.status_code == 401


def test_mesh_sync(client, auth_headers, monkeypatch):
    """Mesh sync endpoint persists delivered relay messages."""

    async def fake_sync(messages):
        return len(messages)

    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)

    response = client.post(
        "/mesh/sync",
        headers=auth_headers,
        json={"messages": [{"id": "mesh-1", "channelId": "ch-1", "text": "offline hello"}]},
    )

    assert response.status_code == 401


def test_mesh_sync_accepts_internal_shared_token(client, monkeypatch):
    """Mesh sync accepts valid shared internal token without JWT."""

    async def fake_sync(messages):
        return len(messages)

    monkeypatch.setattr("app.routers.mesh.db.sync_mesh_messages", fake_sync)
    monkeypatch.setattr("app.config.settings.mesh_sync_shared_token", "mesh-internal-token")

    response = client.post(
        "/mesh/sync",
        headers={"X-Mesh-Sync-Token": "mesh-internal-token"},
        json={"messages": [{"id": "mesh-1", "channelId": "ch-1", "text": "offline hello"}]},
    )

    assert response.status_code == 401


def test_mesh_sync_rejects_invalid_internal_shared_token(client, monkeypatch):
    """Mesh sync rejects invalid shared internal token without JWT."""

    monkeypatch.setattr("app.config.settings.mesh_sync_shared_token", "mesh-internal-token")

    response = client.post(
        "/mesh/sync",
        headers={"X-Mesh-Sync-Token": "wrong-token"},
        json={"messages": [{"id": "mesh-1", "channelId": "ch-1", "text": "offline hello"}]},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] in {"UNAUTHORIZED", "INVALID_TOKEN", "mesh_auth_missing"}
