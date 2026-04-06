"""Tests for carbon router endpoints."""

from __future__ import annotations


class _DummyTask:
    def __init__(self):
        self.called = False

    def delay(self, *_args, **_kwargs):
        self.called = True


def test_get_leaderboard(client, auth_headers, monkeypatch):
    """Leaderboard endpoint returns sorted aggregate rows."""

    async def fake_get_leaderboard(workspace_id: str):
        return [{"user_id": "u1", "total_score": 42, "total_grams_co2": 120.5}]

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
        return {"id": "log-1", **kwargs, "grams_co2": 10.5, "score_delta": 5}

    monkeypatch.setattr("app.routers.carbon.db.create_carbon_log", fake_create_log)
    monkeypatch.setattr("app.routers.carbon.recalculate_carbon_leaderboard", task)

    response = client.post(
        "/carbon/log",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "commute_mode": "bike",
            "distance_km": 4.2,
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["id"] == "log-1"
    assert task.called is True
