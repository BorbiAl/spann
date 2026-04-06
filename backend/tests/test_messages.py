"""Tests for messages router endpoints."""

from __future__ import annotations


class _NoopRateLimiter:
    async def enforce(self, **kwargs):
        return None


def test_get_channel_messages(client, auth_headers, monkeypatch):
    """Message history endpoint returns cursor payload."""

    channel_id = "33333333-3333-4333-8333-333333333333"

    async def fake_get_channel(channel_id: str):
        return {"id": channel_id, "tone": "neutral"}

    async def fake_list_messages(**kwargs):
        return {"messages": [{"id": "m-1", "text": "hello"}], "next_cursor": None}

    monkeypatch.setattr("app.routers.messages.rate_limiter", _NoopRateLimiter())
    monkeypatch.setattr("app.routers.messages.db.get_channel", fake_get_channel)
    monkeypatch.setattr("app.routers.messages.db.list_messages", fake_list_messages)

    response = client.get(f"/channels/{channel_id}/messages", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["data"]["messages"][0]["id"] == "m-1"


def test_create_message(client, auth_headers, monkeypatch):
    """Message creation triggers coaching task and returns created message."""

    called = {"task": False}

    async def fake_get_channel(channel_id: str):
        return {"id": channel_id, "tone": "neutral"}

    async def fake_create_message(**kwargs):
        return {"id": "m-22", **kwargs}

    async def fake_get_user_preferences(user_id: str):
        return {"locale": "en-US", "coaching_enabled": True, "accessibility_settings": {}}

    def fake_trigger_task(**kwargs):
        called["task"] = True

    monkeypatch.setattr("app.routers.messages.rate_limiter", _NoopRateLimiter())
    monkeypatch.setattr("app.routers.messages.db.get_channel", fake_get_channel)
    monkeypatch.setattr("app.routers.messages.db.create_message", fake_create_message)
    monkeypatch.setattr("app.routers.messages.db.get_user_preferences", fake_get_user_preferences)
    monkeypatch.setattr("app.routers.messages.trigger_coaching_task", fake_trigger_task)

    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": "33333333-3333-4333-8333-333333333333", "text": "Hello team"},
    )

    assert response.status_code == 201
    assert response.json()["data"]["id"] == "m-22"
    assert called["task"] is True
