"""Tests for mesh sync endpoint."""

from __future__ import annotations


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

    assert response.status_code == 201
    assert response.json()["data"]["synced"] == 1
