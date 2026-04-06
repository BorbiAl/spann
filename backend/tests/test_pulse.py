"""Tests for pulse endpoint."""

from __future__ import annotations


def test_get_channel_pulse(client, auth_headers, monkeypatch):
    """Pulse endpoint returns latest sentiment snapshot."""

    async def fake_get_snapshot(channel_id: str):
        return {"channel_id": channel_id, "score": 0.1, "label": "neutral"}

    monkeypatch.setattr("app.routers.pulse.db.get_pulse_snapshot", fake_get_snapshot)

    response = client.get("/pulse/ch-1", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["data"]["label"] == "neutral"
