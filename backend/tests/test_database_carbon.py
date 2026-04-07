"""Database carbon logging consistency tests."""

from __future__ import annotations

import pytest

from app.database import DatabaseClient


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeTableQuery:
    def __init__(self, table_name: str, tables: dict[str, list[dict]], updates: dict[str, list[dict]]):
        self.table_name = table_name
        self.tables = tables
        self.updates = updates
        self.filters: dict[str, object] = {}
        self._insert_payload = None
        self._update_payload = None
        self._limit = None

    def select(self, _fields):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def gte(self, _key, _value):
        return self

    def lt(self, _key, _value):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self._limit = value
        return self

    def insert(self, payload):
        self._insert_payload = payload
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    async def execute(self):
        if self._insert_payload is not None:
            self.tables[self.table_name].append(self._insert_payload)
            return _FakeResponse([self._insert_payload])

        if self._update_payload is not None:
            target_id = self.filters.get("id")
            for row in self.tables[self.table_name]:
                if row.get("id") == target_id:
                    row.update(self._update_payload)
                    self.updates[self.table_name].append(dict(row))
                    return _FakeResponse([row])
            return _FakeResponse([])

        rows = []
        for row in self.tables[self.table_name]:
            include = True
            for key, value in self.filters.items():
                if row.get(key) != value:
                    include = False
                    break
            if include:
                rows.append(dict(row))

        if self._limit is not None:
            rows = rows[: self._limit]
        return _FakeResponse(rows)


class _FakeClient:
    def __init__(self, tables: dict[str, list[dict]], updates: dict[str, list[dict]]):
        self.tables = tables
        self.updates = updates

    def table(self, name):
        return _FakeTableQuery(name, self.tables, self.updates)


@pytest.mark.asyncio
async def test_create_carbon_log_updates_same_day_entry_and_applies_delta(monkeypatch):
    db = DatabaseClient()

    tables = {
        "carbon_logs": [
            {
                "id": "existing-log",
                "user_id": "user-1",
                "workspace_id": "workspace-1",
                "score_delta": 5,
                "grams_co2": 30.0,
                "created_at": "2026-04-06T08:00:00+00:00",
            }
        ]
    }
    updates: dict[str, list[dict]] = {"carbon_logs": []}
    fake_client = _FakeClient(tables, updates)

    async def fake_client_getter():
        return fake_client

    deltas = {}

    async def fake_increment(**kwargs):
        deltas.update(kwargs)

    monkeypatch.setattr(db, "client", fake_client_getter)
    monkeypatch.setattr(db, "_increment_carbon_score", fake_increment)

    updated = await db.create_carbon_log(
        user_id="user-1",
        workspace_id="workspace-1",
        commute_mode="car",
        distance_km=1.0,
    )

    assert updated["id"] == "existing-log"
    assert updates["carbon_logs"], "expected same-day record update"
    assert deltas["user_id"] == "user-1"
    assert deltas["workspace_id"] == "workspace-1"
    assert deltas["score_delta"] != 0
