from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.database import DatabaseClient, WorkspaceMember
from app.services.groq_client import GroqRateLimitError, GroqTimeoutError


class _FakeResponse:
    def __init__(self, data: list[dict[str, Any]]):
        self.data = data


class _FakeQuery:
    def __init__(self, *, table: str, rows_by_table: dict[str, list[dict[str, Any]]], raise_error: bool = False):
        self._table = table
        self._rows_by_table = rows_by_table
        self._raise_error = raise_error
        self._filters: dict[str, str] = {}

    def select(self, _fields: str):
        return self

    def eq(self, key: str, value: str):
        self._filters[key] = value
        return self

    def limit(self, _value: int):
        return self

    def order(self, *_args, **_kwargs):
        return self

    async def execute(self) -> _FakeResponse:
        if self._raise_error:
            raise RuntimeError("db boom")

        rows = self._rows_by_table.get(self._table, [])
        filtered: list[dict[str, Any]] = []
        for row in rows:
            include = True
            for key, value in self._filters.items():
                if str(row.get(key)) != str(value):
                    include = False
                    break
            if include:
                filtered.append(row)
        return _FakeResponse(filtered)


class _FakeSupabaseClient:
    def __init__(self, rows_by_table: dict[str, list[dict[str, Any]]], raise_error: bool = False):
        self._rows_by_table = rows_by_table
        self._raise_error = raise_error

    def table(self, table_name: str) -> _FakeQuery:
        return _FakeQuery(table=table_name, rows_by_table=self._rows_by_table, raise_error=self._raise_error)


@pytest.mark.asyncio
async def test_workspace_not_found_raises_404() -> None:
    db = DatabaseClient()
    fake_client = _FakeSupabaseClient(rows_by_table={"workspaces": [], "workspace_members": []})

    async def fake_client_getter():
        return fake_client

    db.client = fake_client_getter  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await db.verify_workspace_access(user_id=UUID("11111111-1111-4111-8111-111111111111"), workspace_id=UUID("22222222-2222-4222-8222-222222222222"))

    assert exc.value.status_code == 404


def test_insufficient_role_raises_403() -> None:
    member = WorkspaceMember(
        workspace_id="22222222-2222-4222-8222-222222222222",
        user_id="11111111-1111-4111-8111-111111111111",
        role="member",
    )

    with pytest.raises(HTTPException) as exc:
        DatabaseClient._assert_role(member, "admin")

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_db_error_propagates_as_500() -> None:
    db = DatabaseClient()
    fake_client = _FakeSupabaseClient(rows_by_table={}, raise_error=True)

    async def fake_client_getter():
        return fake_client

    db.client = fake_client_getter  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await db.verify_workspace_access(user_id=UUID("11111111-1111-4111-8111-111111111111"), workspace_id=UUID("22222222-2222-4222-8222-222222222222"))

    assert exc.value.status_code == 500
    assert exc.value.detail["code"] == "db_error"


def test_carbon_log_exactly_5_entries_allowed(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_workspace_access(**kwargs: Any) -> Any:
        return True

    async def fake_count_daily_carbon_logs(**kwargs: Any) -> int:
        return 4

    async def fake_create_carbon_log(**kwargs: Any) -> dict[str, Any]:
        return {"id": "log-5", **kwargs}

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.carbon.db.count_daily_carbon_logs", fake_count_daily_carbon_logs)
    monkeypatch.setattr("app.routers.carbon.db.create_carbon_log", fake_create_carbon_log)
    monkeypatch.setattr("app.routers.carbon.recalculate_carbon_leaderboard.delay", lambda *_args, **_kwargs: None)

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


def test_carbon_log_6th_entry_rejected(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_workspace_access(**kwargs: Any) -> Any:
        return True

    async def fake_count_daily_carbon_logs(**kwargs: Any) -> int:
        return 5

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.carbon.db.count_daily_carbon_logs", fake_count_daily_carbon_logs)

    response = client.post(
        "/carbon/log",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "transport_type": "bike",
            "kg_co2": 0.0,
        },
    )

    assert response.status_code == 429


def test_carbon_leaderboard_empty_workspace(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_workspace_access(**kwargs: Any) -> Any:
        return True

    async def fake_get_carbon_leaderboard(_workspace_id: str) -> list[dict[str, Any]]:
        return []

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.carbon.db.get_carbon_leaderboard", fake_get_carbon_leaderboard)

    response = client.get("/carbon/leaderboard", params={"workspace_id": "22222222-2222-4222-8222-222222222222"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"] == []


def test_carbon_log_flight_transport(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_workspace_access(**kwargs: Any) -> Any:
        return True

    async def fake_count_daily_carbon_logs(**kwargs: Any) -> int:
        return 0

    async def fake_create_carbon_log(**kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return {"id": "log-flight", **kwargs}

    monkeypatch.setattr("app.routers.carbon.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.carbon.db.count_daily_carbon_logs", fake_count_daily_carbon_logs)
    monkeypatch.setattr("app.routers.carbon.db.create_carbon_log", fake_create_carbon_log)
    monkeypatch.setattr("app.routers.carbon.recalculate_carbon_leaderboard.delay", lambda *_args, **_kwargs: None)

    response = client.post(
        "/carbon/log",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "transport_type": "flight",
            "kg_co2": 120.0,
        },
    )

    assert response.status_code == 201
    assert captured["transport_type"] == "flight"


def test_translate_groq_timeout_fails_open(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_translate(_payload: Any) -> dict[str, str]:
        raise GroqTimeoutError("timeout")

    monkeypatch.setattr("app.routers.translate.translate_culturally", fake_translate)

    response = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": "hola",
            "source_locale": "es-ES",
            "target_locale": "en-US",
            "source_culture": "spanish",
            "target_culture": "american",
            "workplace_tone": "friendly",
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["literal"] == "hola"


def test_translate_groq_rate_limit_fails_open(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_translate(_payload: Any) -> dict[str, str]:
        raise GroqRateLimitError("limited")

    monkeypatch.setattr("app.routers.translate.translate_culturally", fake_translate)

    response = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": "ola",
            "source_locale": "pt-BR",
            "target_locale": "en-US",
            "source_culture": "brazilian",
            "target_culture": "american",
            "workplace_tone": "friendly",
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["cultural"] == "ola"


def test_translate_same_source_target_culture(client, auth_headers) -> None:
    response = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": "hello",
            "source_locale": "en-US",
            "target_locale": "en-US",
            "source_culture": "american",
            "target_culture": "american",
            "workplace_tone": "neutral",
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["literal"]


def test_create_private_channel(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_workspace_access(**kwargs: Any) -> Any:
        return SimpleNamespace(role="member")

    async def fake_create_channel(**kwargs: Any) -> dict[str, Any]:
        return {"id": "ch-private", **kwargs}

    monkeypatch.setattr("app.routers.channels.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.channels.db.create_channel", fake_create_channel)

    response = client.post(
        "/channels",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "name": "private-room",
            "description": "private",
            "tone": "neutral",
            "is_private": True,
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["is_private"] is True


def test_channel_name_with_spaces_rejected(client, auth_headers) -> None:
    response = client.post(
        "/channels",
        headers=auth_headers,
        json={
            "workspace_id": "22222222-2222-4222-8222-222222222222",
            "name": "bad name",
            "description": "x",
            "tone": "neutral",
        },
    )

    assert response.status_code == 422


def test_list_channels_empty_workspace(client, auth_headers, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_workspace_access(**kwargs: Any) -> Any:
        return True

    async def fake_list_channels(_workspace_id: str) -> list[dict[str, Any]]:
        return []

    monkeypatch.setattr("app.routers.channels.db.verify_workspace_access", fake_workspace_access)
    monkeypatch.setattr("app.routers.channels.db.list_channels", fake_list_channels)

    response = client.get("/channels", params={"workspace_id": "22222222-2222-4222-8222-222222222222"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"] == []


def test_health_includes_dependency_states(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert "dependencies" in body
    assert {"postgres", "valkey", "groq"}.issubset(set(body["dependencies"].keys()))


def test_oversized_payload_returns_413(client, auth_headers) -> None:
    huge_phrase = "x" * 1_100_000
    response = client.post(
        "/translate",
        headers=auth_headers,
        json={
            "phrase": huge_phrase,
            "source_locale": "en-US",
            "target_locale": "fr-FR",
            "source_culture": "american",
            "target_culture": "french",
            "workplace_tone": "friendly",
        },
    )

    assert response.status_code == 413
    assert response.json()["error_code"] == "payload_too_large"
