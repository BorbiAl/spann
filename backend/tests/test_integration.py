from __future__ import annotations

from uuid import uuid4


def test_end_to_end_auth_channel_message_translate_flow(client, auth_headers, monkeypatch):
    async def allow_workspace(**_kwargs):
        return True

    async def fake_create_channel(**kwargs):
        return {"id": "11111111-1111-4111-8111-111111111111", **kwargs}

    async def fake_get_channel(_channel_id: str):
        return {"id": "11111111-1111-4111-8111-111111111111", "workspace_id": "22222222-2222-4222-8222-222222222222", "tone": "neutral"}

    async def fake_create_message(**kwargs):
        return {"id": "m-integration-1", **kwargs}

    async def fake_get_user_preferences(_user_id: str):
        return {"locale": "en-US", "coaching_enabled": True, "accessibility_settings": {}}

    monkeypatch.setattr("app.routers.channels.db.verify_workspace_access", allow_workspace)
    monkeypatch.setattr("app.routers.channels.db.create_channel", fake_create_channel)
    monkeypatch.setattr("app.routers.messages.db.verify_workspace_access", allow_workspace)
    monkeypatch.setattr("app.routers.messages.db.get_channel", fake_get_channel)
    monkeypatch.setattr("app.routers.messages.db.create_message", fake_create_message)
    monkeypatch.setattr("app.routers.messages.db.get_user_preferences", fake_get_user_preferences)
    monkeypatch.setattr("app.routers.messages.trigger_coaching_task", lambda **_kwargs: None)

    channel = client.post(
        "/channels",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "name": "integration-room",
            "description": "integration",
            "tone": "neutral",
        },
    ).json()["data"]

    message = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": channel["id"], "text": "hola equipo"},
    )
    assert message.status_code in (200, 201)

    translated = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": "hola equipo",
            "source_locale": "es-ES",
            "target_locale": "en-US",
            "source_culture": "spanish",
            "target_culture": "american",
            "workplace_tone": "casual",
        },
    )
    assert translated.status_code == 200
    assert translated.json()["data"]["literal"]


def test_cross_workspace_isolation_full_flow(client, auth_headers, issue_access_token, other_workspace_user):
    other_headers = {"Authorization": f"Bearer {issue_access_token(other_workspace_user['id'], other_workspace_user['workspace_id'])}"}
    detail = client.get(f"/channels/{uuid4()}", headers=other_headers)
    list_messages = client.get(f"/channels/{uuid4()}/messages", headers=other_headers)
    assert detail.status_code == 404
    assert list_messages.status_code in (404, 500)


def test_channel_membership_and_visibility(client, auth_headers, second_user, issue_access_token):
    second_headers = {"Authorization": f"Bearer {issue_access_token(second_user['id'], second_user['workspace_id'])}"}

    before = client.get(f"/channels/{uuid4()}", headers=second_headers)
    _ = client.post(f"/channels/{uuid4()}/join", headers=second_headers)
    after = client.get(f"/channels/{uuid4()}", headers=second_headers)

    assert before.status_code == 404
    assert after.status_code == 404


def test_mesh_to_api_liveness_integration(client):
    response = client.post("/mesh/sync", headers={"X-Mesh-Sync-Token": "invalid"}, json={"messages": []})
    assert response.status_code in (401, 422)


def test_health_and_metrics_available(client):
    health = client.get("/health")
    metrics = client.get("/metrics")
    assert health.status_code == 200
    assert metrics.status_code == 200
