"""Tests for channels router endpoints."""

from __future__ import annotations


def test_list_channels(client, auth_headers, monkeypatch):
    """List channels returns workspace channels."""

    workspace_id = "22222222-2222-4222-8222-222222222222"

    async def fake_list_channels(workspace_id: str):
        return [{"id": "ch-1", "workspace_id": workspace_id, "name": "general"}]

    monkeypatch.setattr("app.routers.channels.db.list_channels", fake_list_channels)

    response = client.get("/channels", params={"workspace_id": workspace_id}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["data"][0]["id"] == "ch-1"


def test_create_channel(client, auth_headers, monkeypatch):
    """Create channel persists payload and returns created row."""

    async def fake_create_channel(**kwargs):
        return {"id": "ch-2", **kwargs}

    monkeypatch.setattr("app.routers.channels.db.create_channel", fake_create_channel)

    response = client.post(
        "/channels",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "name": "engineering",
            "description": "Engineering team",
            "tone": "direct",
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "engineering"
