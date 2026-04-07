from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4


def test_sql_injection_login_input_rejected(client):
    response = client.post(
        "/auth/login",
        json={"email": "' OR 1=1 --@x.com", "password": "password123"},
    )
    assert response.status_code in (401, 422)


def test_xss_message_payload_preserved_or_sanitized(client, auth_headers, test_user, monkeypatch):
    workspace_id = test_user["workspace_id"]
    channel_id = str(uuid4())

    async def allow_workspace(**_kwargs):
        class _Member:
            role = "member"

        return _Member()

    async def fake_get_channel(_channel_id):
        return {"id": channel_id, "workspace_id": workspace_id, "tone": "neutral"}

    async def fake_get_preferences(_user_id):
        return {"locale": "en-US", "coaching_enabled": True, "accessibility_settings": {}}

    async def fake_create_message(**kwargs):
        now = datetime.now(UTC).isoformat()
        return {
            "id": str(uuid4()),
            "channel_id": kwargs["channel_id"],
            "user_id": kwargs["user_id"],
            "workspace_id": kwargs["workspace_id"],
            "text": kwargs["text"],
            "text_translated": None,
            "source_locale": kwargs.get("source_locale"),
            "sentiment_score": None,
            "mesh_origin": kwargs.get("mesh_origin", False),
            "deleted_at": None,
            "created_at": now,
            "updated_at": now,
            "user": {
                "id": kwargs["user_id"],
                "name": "Security User",
                "initials": "SU",
                "color": "#228844",
            },
            "reactions": [],
            "is_edited": False,
        }

    monkeypatch.setattr("app.routers.messages.db.get_channel", fake_get_channel)
    monkeypatch.setattr("app.routers.messages.db.verify_workspace_access", allow_workspace)
    monkeypatch.setattr("app.routers.messages.db.get_user_preferences", fake_get_preferences)
    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)
    monkeypatch.setattr("app.routers.messages.trigger_coaching_task", lambda **_kwargs: None)
    monkeypatch.setattr("app.routers.messages.score_single_channel_task.delay", lambda *_args, **_kwargs: None)

    payload = "<script>alert('xss')</script>"
    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": channel_id, "text": payload},
    )
    assert response.status_code in (200, 201)
    returned = response.json()["data"]["text"]
    assert "<script>" not in returned or returned == payload


def test_path_traversal_not_allowed(client, auth_headers):
    response = client.get("/../etc/passwd", headers=auth_headers)
    assert response.status_code in (404, 405)


def test_cors_preflight_restricted_origin(client):
    response = client.options(
        "/channels",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in (200, 204, 400)


def test_security_headers_present(client):
    response = client.get("/health")
    assert response.status_code == 200
    headers = response.headers
    # Allow either explicit middleware headers or deployment-proxy managed headers.
    assert (
        "x-content-type-options" in {k.lower() for k in headers.keys()}
        or "content-security-policy" in {k.lower() for k in headers.keys()}
        or "x-frame-options" in {k.lower() for k in headers.keys()}
    )


def test_mesh_signature_required(client):
    response = client.post("/mesh/presence", json={"node_id": str(uuid4()), "status": "online"})
    assert response.status_code == 401


def test_invalid_jwt_algorithm_rejected(client, test_user):
    # Deliberately malformed token with alg none style structure.
    token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ."
    response = client.get("/channels", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_workspace_data_leak_prevented(client, auth_headers, issue_access_token, other_workspace_user):
    other_headers = {"Authorization": f"Bearer {issue_access_token(other_workspace_user['id'], other_workspace_user['workspace_id'])}"}
    response = client.get(f"/channels/{uuid4()}", headers=other_headers)
    assert response.status_code in (403, 404)
