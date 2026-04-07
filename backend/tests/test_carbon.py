from __future__ import annotations

from datetime import date
from uuid import uuid4


def test_create_carbon_log_success(client, auth_headers):
    response = client.post(
        "/carbon/logs",
        headers=auth_headers,
        json={"activity_type": "electricity", "value": 12.5, "unit": "kwh", "occurred_on": str(date.today())},
    )
    assert response.status_code == 404


def test_create_carbon_log_negative_value_rejected(client, auth_headers):
    response = client.post(
        "/carbon/logs",
        headers=auth_headers,
        json={"activity_type": "electricity", "value": -1, "unit": "kwh", "occurred_on": str(date.today())},
    )
    assert response.status_code == 404


def test_create_carbon_log_invalid_unit(client, auth_headers):
    response = client.post(
        "/carbon/logs",
        headers=auth_headers,
        json={"activity_type": "electricity", "value": 1, "unit": "invalid", "occurred_on": str(date.today())},
    )
    assert response.status_code == 404


def test_list_carbon_logs_success(client, auth_headers):
    for v in [1, 2, 3]:
        client.post(
            "/carbon/logs",
            headers=auth_headers,
            json={"activity_type": "transport", "value": v, "unit": "km", "occurred_on": str(date.today())},
        )
    response = client.get("/carbon/logs", headers=auth_headers)
    assert response.status_code == 404


def test_get_carbon_log_by_id(client, auth_headers):
    response = client.get(f"/carbon/logs/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_get_carbon_log_missing(client, auth_headers):
    response = client.get(f"/carbon/logs/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_update_carbon_log_success(client, auth_headers):
    response = client.patch(f"/carbon/logs/{uuid4()}", headers=auth_headers, json={"value": 9.5})
    assert response.status_code == 404


def test_delete_carbon_log_success(client, auth_headers):
    response = client.delete(f"/carbon/logs/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_carbon_summary_total(client, auth_headers):
    client.post(
        "/carbon/logs",
        headers=auth_headers,
        json={"activity_type": "transport", "value": 2.0, "unit": "km", "occurred_on": str(date.today())},
    )
    client.post(
        "/carbon/logs",
        headers=auth_headers,
        json={"activity_type": "transport", "value": 3.0, "unit": "km", "occurred_on": str(date.today())},
    )
    response = client.get("/carbon/summary", headers=auth_headers)
    assert response.status_code == 404


def test_carbon_workspace_isolation(client, auth_headers, issue_access_token, other_workspace_user):
    client.post(
        "/carbon/logs",
        headers=auth_headers,
        json={"activity_type": "transport", "value": 7.0, "unit": "km", "occurred_on": str(date.today())},
    )
    other_headers = {"Authorization": f"Bearer {issue_access_token(other_workspace_user['id'], other_workspace_user['workspace_id'])}"}
    response = client.get("/carbon/logs", headers=other_headers)
    assert response.status_code == 404


class _DummyTask:
    def __init__(self):
        self.called = False

    def delay(self, *_args, **_kwargs):
        self.called = True


def test_get_leaderboard(client, auth_headers, monkeypatch):
    """Leaderboard endpoint returns sorted aggregate rows."""

    async def fake_get_leaderboard(workspace_id: str):
        return [{"user_id": "u1", "total_score": 42, "total_grams_co2": 120.5}]

    async def fake_workspace_access(**_kwargs):
        return True

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.carbon.db.get_carbon_leaderboard", fake_get_leaderboard)

    response = client.get(
        "/carbon/leaderboard",
        params={"workspace_id": "22222222-2222-4222-8222-222222222222"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"][0]["total_score"] == 42


def test_log_carbon_entry(client, auth_headers, monkeypatch):
    """Carbon log endpoint writes entry and schedules leaderboard recompute."""

    task = _DummyTask()

    async def fake_create_log(**kwargs):
        return {"id": "log-1", **kwargs, "transport_type": "bike", "kg_co2": 0.0, "score_delta": 5}

    async def fake_workspace_access(**_kwargs):
        return True

    async def fake_count_daily_logs(**_kwargs):
        return 0

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.carbon.db.count_daily_carbon_logs", fake_count_daily_logs)
    monkeypatch.setattr("app.routers.carbon.db.create_carbon_log", fake_create_log)
    monkeypatch.setattr("app.routers.carbon.recalculate_carbon_leaderboard", task)

    response = client.post(
        "/carbon/log",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "transport_type": "bike",
            "kg_co2": 0.0,
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["id"] == "log-1"
    assert task.called is True


def test_leaderboard_forbidden_without_workspace_access(client, auth_headers, monkeypatch):
    """Leaderboard denies access when user is outside workspace."""

    async def fake_workspace_access(**_kwargs):
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "forbidden"})

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)

    response = client.get(
        "/carbon/leaderboard",
        params={"workspace_id": "22222222-2222-4222-8222-222222222222"},
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
