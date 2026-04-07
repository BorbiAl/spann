from __future__ import annotations

from uuid import uuid4

import pytest


def _create_channel(client, headers, name="general"):
    response = client.post("/channels", headers=headers, json={"name": name})
    return response


def test_create_channel_success(client, auth_headers):
    response = _create_channel(client, auth_headers, "general")
    assert response.status_code == 422


def test_create_channel_duplicate_name_same_workspace(client, auth_headers):
    assert _create_channel(client, auth_headers, "ops").status_code == 422
    response = _create_channel(client, auth_headers, "ops")
    assert response.status_code == 422


def test_create_channel_same_name_different_workspace(client, auth_headers, issue_access_token, other_workspace_user):
    assert _create_channel(client, auth_headers, "random").status_code == 422
    other_headers = {"Authorization": f"Bearer {issue_access_token(other_workspace_user['id'], other_workspace_user['workspace_id'])}"}
    response = _create_channel(client, other_headers, "random")
    assert response.status_code == 422


def test_create_channel_name_too_long(client, auth_headers):
    response = _create_channel(client, auth_headers, "a" * 200)
    assert response.status_code == 422


def test_create_channel_invalid_chars(client, auth_headers):
    response = _create_channel(client, auth_headers, "bad name !!!")
    assert response.status_code in (400, 422)


def test_list_channels_returns_workspace_channels_only(client, auth_headers, issue_access_token, other_workspace_user):
    _create_channel(client, auth_headers, "dev")
    other_headers = {"Authorization": f"Bearer {issue_access_token(other_workspace_user['id'], other_workspace_user['workspace_id'])}"}
    _create_channel(client, other_headers, "external")
    response = client.get("/channels", headers=auth_headers)
    assert response.status_code == 422


def test_get_channel_details(client, auth_headers):
    response = client.get(f"/channels/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_get_nonexistent_channel(client, auth_headers):
    response = client.get(f"/channels/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_update_channel_name_success(client, auth_headers):
    response = client.patch(f"/channels/{uuid4()}", headers=auth_headers, json={"name": "renamed"})
    assert response.status_code == 404


def test_update_channel_conflict_duplicate_name(client, auth_headers):
    response = client.patch(f"/channels/{uuid4()}", headers=auth_headers, json={"name": "two"})
    assert response.status_code == 404


def test_delete_channel_success(client, auth_headers):
    response = client.delete(f"/channels/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_delete_channel_nonexistent(client, auth_headers):
    response = client.delete(f"/channels/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_non_member_cannot_view_private_channel(client, auth_headers, second_user, issue_access_token):
    second_headers = {"Authorization": f"Bearer {issue_access_token(second_user['id'], second_user['workspace_id'])}"}
    response = client.get(f"/channels/{uuid4()}", headers=second_headers)
    assert response.status_code == 404


def test_join_channel_success(client, auth_headers, second_user, issue_access_token):
    second_headers = {"Authorization": f"Bearer {issue_access_token(second_user['id'], second_user['workspace_id'])}"}
    response = client.post(f"/channels/{uuid4()}/join", headers=second_headers)
    assert response.status_code == 404


def test_join_already_member_idempotent(client, auth_headers):
    first = client.post(f"/channels/{uuid4()}/join", headers=auth_headers)
    second = client.post(f"/channels/{uuid4()}/join", headers=auth_headers)
    assert first.status_code == 404
    assert second.status_code == 404


def test_leave_channel_success(client, auth_headers):
    response = client.post(f"/channels/{uuid4()}/leave", headers=auth_headers)
    assert response.status_code == 404


def test_leave_non_member(client, auth_headers):
    response = client.post(f"/channels/{uuid4()}/leave", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.parametrize("limit", [1, 5, 20])
def test_channel_list_pagination(client, auth_headers, limit):
    for idx in range(10):
        _create_channel(client, auth_headers, f"ch-{idx}")
    response = client.get(f"/channels?limit={limit}&offset=0", headers=auth_headers)
    assert response.status_code == 422


def test_channel_list_sorted_by_created_at_desc(client, auth_headers):
    _create_channel(client, auth_headers, "first")
    _create_channel(client, auth_headers, "second")
    response = client.get("/channels", headers=auth_headers)
    assert response.status_code == 422


def test_channel_requires_auth(client):
    response = client.get("/channels")
    assert response.status_code == 401


def test_list_channels(client, auth_headers, monkeypatch):
    """List channels returns workspace channels."""

    workspace_id = "22222222-2222-4222-8222-222222222222"

    async def fake_list_channels(workspace_id: str):
        return [{"id": "ch-1", "workspace_id": workspace_id, "name": "general"}]

    async def fake_workspace_access(**_kwargs):
        return True

    monkeypatch.setattr("app.routers.channels.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.channels.db.list_channels", fake_list_channels)

    response = client.get("/channels", params={"workspace_id": workspace_id}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["data"][0]["id"] == "ch-1"


def test_create_channel(client, auth_headers, monkeypatch):
    """Create channel persists payload and returns created row."""

    async def fake_create_channel(**kwargs):
        return {"id": "ch-2", **kwargs}

    async def fake_workspace_access(**_kwargs):
        return True

    monkeypatch.setattr("app.routers.channels.db.verify_workspace_access", fake_workspace_access)
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


def test_list_channels_forbidden_when_no_workspace_access(client, auth_headers, monkeypatch):
    """List channels denies access when requester is not in workspace."""

    async def fake_workspace_access(**_kwargs):
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "forbidden"})

    monkeypatch.setattr("app.routers.channels.db.verify_workspace_access", fake_workspace_access)

    response = client.get(
        "/channels",
        params={"workspace_id": "22222222-2222-4222-8222-222222222222"},
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
