from __future__ import annotations

from uuid import uuid4


def test_list_workspace_members_success(client, auth_headers, monkeypatch):
    workspace_id = "11111111-1111-4111-8111-111111111111"

    async def fake_verify_workspace_access(**_kwargs):
        return True

    async def fake_list_workspace_members(*, workspace_id: str):
        return [
            {
                "user_id": "u-1",
                "display_name": "Alex Rivera",
                "email": "alex@example.com",
                "role": "owner",
                "is_online": True,
            }
        ]

    monkeypatch.setattr("app.routers.organizations.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.organizations.db.list_workspace_members", fake_list_workspace_members)

    response = client.get(f"/organizations/{workspace_id}/members", headers=auth_headers)

    assert response.status_code == 200
    rows = response.json()["data"]
    assert isinstance(rows, list)
    assert rows[0]["user_id"] == "u-1"
    assert rows[0]["is_online"] is True


def test_remove_workspace_member_success(client, auth_headers, monkeypatch):
    workspace_id = "11111111-1111-4111-8111-111111111111"
    member_user_id = "22222222-2222-4222-8222-222222222222"

    async def fake_verify_workspace_access(**_kwargs):
        return True

    async def fake_list_workspace_members(*, workspace_id: str):
        return [
            {
                "user_id": member_user_id,
                "display_name": "Member One",
                "role": "member",
                "is_online": False,
            }
        ]

    async def fake_remove_workspace_member(*, workspace_id: str, member_user_id: str):
        return {"workspace_id": workspace_id, "member_user_id": member_user_id, "removed": True}

    monkeypatch.setattr("app.routers.organizations.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.organizations.db.list_workspace_members", fake_list_workspace_members)
    monkeypatch.setattr("app.routers.organizations.db.remove_workspace_member", fake_remove_workspace_member)

    response = client.delete(
        f"/organizations/{workspace_id}/members/{member_user_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["removed"] is True


def test_remove_workspace_member_owner_forbidden(client, auth_headers, monkeypatch):
    workspace_id = "11111111-1111-4111-8111-111111111111"
    owner_member_id = str(uuid4())

    async def fake_verify_workspace_access(**_kwargs):
        return True

    async def fake_list_workspace_members(*, workspace_id: str):
        return [
            {
                "user_id": owner_member_id,
                "display_name": "Owner Two",
                "role": "owner",
                "is_online": True,
            }
        ]

    monkeypatch.setattr("app.routers.organizations.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.organizations.db.list_workspace_members", fake_list_workspace_members)

    response = client.delete(
        f"/organizations/{workspace_id}/members/{owner_member_id}",
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "owner_remove_forbidden"
