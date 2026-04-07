from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services import message_service
from app.services.redis_publisher import get_redis_publisher


CHANNEL_ID = "33333333-3333-4333-8333-333333333333"
WORKSPACE_ID = "22222222-2222-4222-8222-222222222222"
USER_ID = "11111111-1111-4111-8111-111111111111"


def _message_row(
    *,
    message_id: str | None = None,
    channel_id: str = CHANNEL_ID,
    workspace_id: str = WORKSPACE_ID,
    user_id: str = USER_ID,
    text: str = "hello",
    deleted_at: datetime | None = None,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
    mesh_origin: bool = False,
    source_locale: str | None = None,
    reactions: list[dict] | None = None,
    is_edited: bool = False,
) -> dict:
    created = created_at or datetime.now(UTC)
    updated = updated_at or created
    return {
        "id": message_id or str(uuid4()),
        "channel_id": channel_id,
        "user_id": user_id,
        "workspace_id": workspace_id,
        "text": text,
        "text_translated": None,
        "source_locale": source_locale,
        "sentiment_score": None,
        "mesh_origin": mesh_origin,
        "deleted_at": deleted_at,
        "created_at": created,
        "updated_at": updated,
        "user": {
            "id": user_id,
            "name": "Ada Lovelace",
            "initials": "AL",
            "color": "#1d4ed8",
        },
        "reactions": reactions or [],
        "is_edited": is_edited,
    }


@dataclass
class _FakePublisher:
    calls: list[tuple[str, dict]]

    async def publish(self, channel: str, payload: dict) -> None:
        self.calls.append((channel, payload))

    async def close(self) -> None:
        return None


@pytest.fixture(autouse=True)
def _disable_rate_limit(monkeypatch):
    async def allow(**kwargs):
        return None

    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", allow)


@pytest.fixture(autouse=True)
def _default_channel_access(monkeypatch):
    async def fake_get_channel(channel_id: str):
        return {"id": channel_id, "workspace_id": WORKSPACE_ID, "tone": "supportive"}

    async def fake_verify_workspace_access(**kwargs):
        return SimpleNamespace(role="member")

    async def fake_preferences(_user_id: str):
        return {"locale": "en-US"}

    monkeypatch.setattr("app.routers.messages.db.get_channel", fake_get_channel)
    monkeypatch.setattr("app.routers.messages.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.messages.db.get_user_preferences", fake_preferences)


@pytest.fixture()
def fake_redis_publisher(test_app):
    publisher = _FakePublisher(calls=[])
    test_app.dependency_overrides[get_redis_publisher] = lambda: publisher
    yield publisher
    test_app.dependency_overrides.pop(get_redis_publisher, None)


@pytest.fixture(autouse=True)
def _default_async_task_noops(monkeypatch):
    monkeypatch.setattr("app.routers.messages.trigger_coaching_task", lambda **kwargs: None)
    monkeypatch.setattr("app.routers.messages.score_single_channel_task.delay", lambda *args, **kwargs: None)


# Send Message (8)


def test_send_message_success(client, auth_headers, monkeypatch):
    async def fake_create_message(**kwargs):
        return _message_row(text=kwargs["text"], source_locale=kwargs["source_locale"], mesh_origin=kwargs["mesh_origin"])

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)

    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "hello"},
    )

    assert response.status_code == 201
    assert response.json()["data"]["text"] == "hello"


def test_send_message_coaching_task_triggered(client, auth_headers, monkeypatch):
    called = {"task": False}

    async def fake_create_message(**kwargs):
        return _message_row(text=kwargs["text"])

    def fake_trigger(**kwargs):
        called["task"] = True

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)
    monkeypatch.setattr("app.routers.messages.trigger_coaching_task", fake_trigger)

    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "Hello team"},
    )

    assert response.status_code == 201
    assert called["task"] is True


def test_send_message_empty_text_rejected(client, auth_headers):
    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "   "},
    )
    assert response.status_code == 422


def test_send_message_too_long_rejected(client, auth_headers):
    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "x" * 4097},
    )
    assert response.status_code == 422


def test_send_message_wrong_channel_forbidden(client, auth_headers, monkeypatch):
    async def deny_access(**kwargs):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "forbidden"})

    monkeypatch.setattr("app.routers.messages.db.verify_workspace_access", deny_access)

    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "nope"},
    )

    assert response.status_code == 403


def test_send_message_extra_fields_rejected(client, auth_headers):
    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "hello", "extra": "blocked"},
    )
    assert response.status_code == 422


def test_send_message_mesh_origin_stored(client, auth_headers, monkeypatch):
    captured = {"mesh_origin": None}

    async def fake_create_message(**kwargs):
        captured["mesh_origin"] = kwargs["mesh_origin"]
        return _message_row(text=kwargs["text"], mesh_origin=kwargs["mesh_origin"])

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)

    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "mesh", "mesh_origin": True},
    )

    assert response.status_code == 201
    assert captured["mesh_origin"] is True
    assert response.json()["data"]["mesh_origin"] is True


def test_send_message_source_locale_stored(client, auth_headers, monkeypatch):
    captured = {"source_locale": None}

    async def fake_create_message(**kwargs):
        captured["source_locale"] = kwargs["source_locale"]
        return _message_row(text=kwargs["text"], source_locale=kwargs["source_locale"])

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)

    response = client.post(
        "/messages",
        headers=auth_headers,
        json={"channel_id": CHANNEL_ID, "text": "hola", "source_locale": "es-ES"},
    )

    assert response.status_code == 201
    assert captured["source_locale"] == "es-ES"
    assert response.json()["data"]["source_locale"] == "es-ES"


# Get Messages Pagination (7)


def _build_dataset(total: int) -> list[dict]:
    base = datetime(2026, 4, 1, tzinfo=UTC)
    rows = []
    for idx in range(total):
        rows.append(
            _message_row(
                message_id=f"00000000-0000-4000-8000-{idx:012d}",
                text=f"msg-{idx}",
                created_at=base - timedelta(seconds=idx),
                updated_at=base - timedelta(seconds=idx),
            )
        )
    return rows


def _pagination_stub(dataset: list[dict]):
    async def fake_get_messages_page(db, channel_id, user_id, cursor, limit):
        anchor_index = 0
        if cursor:
            cursor_id, _ = message_service.decode_cursor(cursor)
            for pos, row in enumerate(dataset):
                if row["id"] == cursor_id:
                    anchor_index = pos + 1
                    break

        page = dataset[anchor_index : anchor_index + limit]
        has_more = anchor_index + limit < len(dataset)
        next_cursor = None
        if has_more and page:
            next_cursor = message_service.encode_cursor(page[-1]["id"], page[-1]["created_at"])
        return page, has_more, next_cursor

    return fake_get_messages_page


def test_get_messages_returns_messages(client, auth_headers, monkeypatch):
    dataset = _build_dataset(5)
    monkeypatch.setattr("app.routers.messages.message_service.get_messages_page", _pagination_stub(dataset))

    response = client.get(f"/channels/{CHANNEL_ID}/messages", headers=auth_headers)
    body = response.json()["data"]

    assert response.status_code == 200
    assert len(body["messages"]) == 5
    assert body["has_more"] is False


def test_get_messages_cursor_pagination_correct(client, auth_headers, monkeypatch):
    dataset = _build_dataset(12)
    monkeypatch.setattr("app.routers.messages.message_service.get_messages_page", _pagination_stub(dataset))

    first = client.get(f"/channels/{CHANNEL_ID}/messages?limit=5", headers=auth_headers).json()["data"]
    second = client.get(
        f"/channels/{CHANNEL_ID}/messages?limit=5&cursor={first['next_cursor']}",
        headers=auth_headers,
    ).json()["data"]

    assert len(first["messages"]) == 5
    assert len(second["messages"]) == 5
    assert first["messages"][0]["id"] != second["messages"][0]["id"]


def test_get_messages_no_duplicates_across_pages(client, auth_headers, monkeypatch):
    dataset = _build_dataset(21)
    monkeypatch.setattr("app.routers.messages.message_service.get_messages_page", _pagination_stub(dataset))

    cursor = None
    seen = []
    while True:
        path = f"/channels/{CHANNEL_ID}/messages?limit=7"
        if cursor:
            path += f"&cursor={cursor}"
        page = client.get(path, headers=auth_headers).json()["data"]
        seen.extend([row["id"] for row in page["messages"]])
        if not page["has_more"]:
            break
        cursor = page["next_cursor"]

    assert len(seen) == len(set(seen))


def test_get_messages_no_skips_across_five_pages(client, auth_headers, monkeypatch):
    dataset = _build_dataset(50)
    monkeypatch.setattr("app.routers.messages.message_service.get_messages_page", _pagination_stub(dataset))

    cursor = None
    collected = []
    for _ in range(5):
        path = f"/channels/{CHANNEL_ID}/messages?limit=10"
        if cursor:
            path += f"&cursor={cursor}"
        page = client.get(path, headers=auth_headers).json()["data"]
        collected.extend([row["id"] for row in page["messages"]])
        cursor = page["next_cursor"]

    expected = [row["id"] for row in dataset]
    assert collected == expected


def test_get_messages_deleted_messages_redacted(client, auth_headers, monkeypatch):
    dataset = [_message_row(text="secret", deleted_at=datetime.now(UTC))]

    async def fake_get_messages_page(db, channel_id, user_id, cursor, limit):
        return dataset, False, None

    monkeypatch.setattr("app.routers.messages.message_service.get_messages_page", fake_get_messages_page)

    response = client.get(f"/channels/{CHANNEL_ID}/messages", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"]["messages"][0]["text"] == "[deleted]"


def test_get_messages_wrong_channel_forbidden(client, auth_headers, monkeypatch):
    async def deny_access(**kwargs):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "forbidden"})

    monkeypatch.setattr("app.routers.messages.db.verify_workspace_access", deny_access)

    response = client.get(f"/channels/{CHANNEL_ID}/messages", headers=auth_headers)
    assert response.status_code == 403


def test_get_messages_limit_param_max_100_enforced(client, auth_headers):
    response = client.get(f"/channels/{CHANNEL_ID}/messages?limit=101", headers=auth_headers)
    assert response.status_code == 422


# Edit Message (6)


def test_edit_message_success(client, auth_headers, monkeypatch):
    async def fake_edit_message(**kwargs):
        return _message_row(text=kwargs["new_text"], is_edited=True, updated_at=datetime.now(UTC))

    monkeypatch.setattr("app.routers.messages.message_service.edit_message", fake_edit_message)

    response = client.patch(
        f"/messages/{uuid4()}",
        headers=auth_headers,
        json={"text": "updated"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["text"] == "updated"


def test_edit_message_not_owner_forbidden(client, auth_headers, monkeypatch):
    async def fake_edit_message(**kwargs):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "forbidden"})

    monkeypatch.setattr("app.routers.messages.message_service.edit_message", fake_edit_message)

    response = client.patch(f"/messages/{uuid4()}", headers=auth_headers, json={"text": "hack"})
    assert response.status_code == 403


def test_edit_message_after_five_minutes_rejected(client, auth_headers, monkeypatch):
    async def fake_edit_message(**kwargs):
        raise HTTPException(
            status_code=409,
            detail={"code": "edit_window_expired", "error_code": "edit_window_expired", "message": "expired"},
        )

    monkeypatch.setattr("app.routers.messages.message_service.edit_message", fake_edit_message)

    response = client.patch(f"/messages/{uuid4()}", headers=auth_headers, json={"text": "late"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "edit_window_expired"


@pytest.mark.asyncio
async def test_edit_message_stores_original_in_message_edits(monkeypatch):
    original = _message_row(text="before")

    async def fake_verify_ownership(db, message_id, user_id):
        return original

    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id, text="after", is_edited=True)

    monkeypatch.setattr("app.services.message_service.verify_message_ownership", fake_verify_ownership)
    monkeypatch.setattr("app.services.message_service.get_message_by_id", fake_get_message_by_id)

    class FakeQuery:
        def __init__(self, table):
            self.table = table
            self.action = ""
            self.payload = None
            self.filters = []

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def eq(self, field, value):
            self.filters.append((field, value))
            return self

    class FakeClient:
        def table(self, name):
            return FakeQuery(name)

    class FakeDB:
        def __init__(self):
            self.calls = []

        async def client(self):
            return FakeClient()

        async def _execute(self, operation, query):
            self.calls.append((operation, query.table, query.action, query.payload, query.filters))
            return SimpleNamespace(data=[{}])

    fake_db = FakeDB()
    await message_service.edit_message(fake_db, str(uuid4()), USER_ID, "after")

    history_entries = [call for call in fake_db.calls if call[1] == "message_edits" and call[2] == "insert"]
    assert history_entries
    assert history_entries[0][3]["previous_text"] == "before"


def test_edit_message_deleted_message_cannot_be_edited(client, auth_headers, monkeypatch):
    async def fake_edit_message(**kwargs):
        raise HTTPException(
            status_code=409,
            detail={"code": "message_deleted", "error_code": "message_deleted", "message": "deleted"},
        )

    monkeypatch.setattr("app.routers.messages.message_service.edit_message", fake_edit_message)

    response = client.patch(f"/messages/{uuid4()}", headers=auth_headers, json={"text": "edit"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "message_deleted"


def test_edit_message_nonexistent_returns_404(client, auth_headers, monkeypatch):
    async def fake_edit_message(**kwargs):
        raise HTTPException(
            status_code=404,
            detail={"code": "message_not_found", "error_code": "message_not_found", "message": "missing"},
        )

    monkeypatch.setattr("app.routers.messages.message_service.edit_message", fake_edit_message)

    response = client.patch(f"/messages/{uuid4()}", headers=auth_headers, json={"text": "edit"})
    assert response.status_code == 404


# Delete Message (5)


def test_delete_message_success_returns_204(client, auth_headers, monkeypatch):
    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id)

    async def fake_soft_delete_message(**kwargs):
        return None

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.soft_delete_message", fake_soft_delete_message)

    response = client.delete(f"/messages/{uuid4()}", headers=auth_headers)
    assert response.status_code == 204


def test_delete_message_content_redacted_in_subsequent_get(client, auth_headers, monkeypatch):
    state = {"deleted": False}
    msg_id = str(uuid4())

    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id, deleted_at=datetime.now(UTC) if state["deleted"] else None)

    async def fake_soft_delete_message(**kwargs):
        state["deleted"] = True

    async def fake_get_messages_page(db, channel_id, user_id, cursor, limit):
        row = _message_row(message_id=msg_id, text="private", deleted_at=datetime.now(UTC) if state["deleted"] else None)
        return [row], False, None

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.soft_delete_message", fake_soft_delete_message)
    monkeypatch.setattr("app.routers.messages.message_service.get_messages_page", fake_get_messages_page)

    delete_response = client.delete(f"/messages/{msg_id}", headers=auth_headers)
    list_response = client.get(f"/channels/{CHANNEL_ID}/messages", headers=auth_headers)

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json()["data"]["messages"][0]["text"] == "[deleted]"


def test_delete_message_not_owner_forbidden(client, auth_headers, monkeypatch):
    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id, user_id=str(uuid4()))

    async def fake_soft_delete_message(**kwargs):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "forbidden"})

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.soft_delete_message", fake_soft_delete_message)

    response = client.delete(f"/messages/{uuid4()}", headers=auth_headers)
    assert response.status_code == 403


def test_delete_message_admin_can_delete_any_message(client, auth_headers, monkeypatch):
    captured = {"role": None}

    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id, user_id=str(uuid4()))

    async def fake_verify_workspace_access(**kwargs):
        return SimpleNamespace(role="admin")

    async def fake_soft_delete_message(**kwargs):
        captured["role"] = kwargs["user_role"]

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.db.verify_workspace_access", fake_verify_workspace_access)
    monkeypatch.setattr("app.routers.messages.message_service.soft_delete_message", fake_soft_delete_message)

    response = client.delete(f"/messages/{uuid4()}", headers=auth_headers)
    assert response.status_code == 204
    assert captured["role"] == "admin"


def test_delete_message_already_deleted_is_idempotent(client, auth_headers, monkeypatch):
    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id, deleted_at=datetime.now(UTC))

    async def fake_soft_delete_message(**kwargs):
        return None

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.soft_delete_message", fake_soft_delete_message)

    response = client.delete(f"/messages/{uuid4()}", headers=auth_headers)
    assert response.status_code == 204


# Reactions (5)


def test_reaction_add_success(client, auth_headers, monkeypatch):
    message_id = str(uuid4())

    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id)

    async def fake_toggle_reaction(**kwargs):
        return [{"emoji": "👍", "count": 1, "reacted_by_me": True}]

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.toggle_reaction", fake_toggle_reaction)

    response = client.post(
        f"/messages/{message_id}/reactions",
        headers=auth_headers,
        json={"emoji": "👍"},
    )

    assert response.status_code == 200
    assert response.json()["data"][0]["count"] == 1


def test_reaction_second_call_removes_reaction(client, auth_headers, monkeypatch):
    message_id = str(uuid4())
    state = {"on": False}

    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id)

    async def fake_toggle_reaction(**kwargs):
        state["on"] = not state["on"]
        if state["on"]:
            return [{"emoji": "🔥", "count": 1, "reacted_by_me": True}]
        return []

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.toggle_reaction", fake_toggle_reaction)

    first = client.post(f"/messages/{message_id}/reactions", headers=auth_headers, json={"emoji": "🔥"})
    second = client.post(f"/messages/{message_id}/reactions", headers=auth_headers, json={"emoji": "🔥"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["data"] == []


def test_reaction_count_correct(client, auth_headers, monkeypatch):
    async def fake_get_message_by_id(db, message_id):
        return _message_row()

    async def fake_toggle_reaction(**kwargs):
        return [{"emoji": "🔥", "count": 3, "reacted_by_me": True}]

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.toggle_reaction", fake_toggle_reaction)

    response = client.post(f"/messages/{uuid4()}/reactions", headers=auth_headers, json={"emoji": "🔥"})
    assert response.status_code == 200
    assert response.json()["data"][0]["count"] == 3


def test_reaction_multiple_users_same_emoji_aggregated(client, auth_headers, monkeypatch):
    async def fake_get_message_by_id(db, message_id):
        return _message_row()

    async def fake_toggle_reaction(**kwargs):
        return [
            {"emoji": "👍", "count": 2, "reacted_by_me": True},
            {"emoji": "🎉", "count": 1, "reacted_by_me": False},
        ]

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.toggle_reaction", fake_toggle_reaction)

    response = client.post(f"/messages/{uuid4()}/reactions", headers=auth_headers, json={"emoji": "👍"})

    assert response.status_code == 200
    assert response.json()["data"][0]["emoji"] == "👍"
    assert response.json()["data"][0]["count"] == 2


def test_reaction_wrong_emoji_format_rejected(client, auth_headers):
    response = client.post(f"/messages/{uuid4()}/reactions", headers=auth_headers, json={"emoji": "   "})
    assert response.status_code == 422


# Redis Publishing (4)


def test_redis_message_new_published_on_send(client, auth_headers, monkeypatch, fake_redis_publisher):
    async def fake_create_message(**kwargs):
        return _message_row(text=kwargs["text"])

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)

    response = client.post("/messages", headers=auth_headers, json={"channel_id": CHANNEL_ID, "text": "new"})
    assert response.status_code == 201
    assert fake_redis_publisher.calls
    assert fake_redis_publisher.calls[-1][1]["event"] == "message:new"


def test_redis_message_edited_published_on_edit(client, auth_headers, monkeypatch, fake_redis_publisher):
    async def fake_edit_message(**kwargs):
        return _message_row(text=kwargs["new_text"], is_edited=True)

    monkeypatch.setattr("app.routers.messages.message_service.edit_message", fake_edit_message)

    response = client.patch(f"/messages/{uuid4()}", headers=auth_headers, json={"text": "edited"})
    assert response.status_code == 200
    assert fake_redis_publisher.calls[-1][1]["event"] == "message:edited"


def test_redis_message_deleted_published_on_delete(client, auth_headers, monkeypatch, fake_redis_publisher):
    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id)

    async def fake_soft_delete_message(**kwargs):
        return None

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.soft_delete_message", fake_soft_delete_message)

    response = client.delete(f"/messages/{uuid4()}", headers=auth_headers)
    assert response.status_code == 204
    assert fake_redis_publisher.calls[-1][1]["event"] == "message:deleted"


def test_redis_message_reaction_published_on_toggle(client, auth_headers, monkeypatch, fake_redis_publisher):
    async def fake_get_message_by_id(db, message_id):
        return _message_row(message_id=message_id)

    async def fake_toggle_reaction(**kwargs):
        return [{"emoji": "👍", "count": 1, "reacted_by_me": True}]

    monkeypatch.setattr("app.routers.messages.message_service.get_message_by_id", fake_get_message_by_id)
    monkeypatch.setattr("app.routers.messages.message_service.toggle_reaction", fake_toggle_reaction)

    response = client.post(f"/messages/{uuid4()}/reactions", headers=auth_headers, json={"emoji": "👍"})
    assert response.status_code == 200
    assert fake_redis_publisher.calls[-1][1]["event"] == "message:reaction"


# Rate Limiting (2)


def test_rate_limit_61st_message_returns_429(client, auth_headers, monkeypatch):
    async def fake_create_message(**kwargs):
        return _message_row(text=kwargs["text"])

    counters = {}

    async def strict_enforce(*, identity: str, **kwargs):
        counters[identity] = counters.get(identity, 0) + 1
        if counters[identity] > 60:
            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)
    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", strict_enforce)

    status_codes = []
    for idx in range(61):
        response = client.post(
            "/messages",
            headers=auth_headers,
            json={"channel_id": CHANNEL_ID, "text": f"m-{idx}"},
        )
        status_codes.append(response.status_code)

    assert status_codes[-1] == 429


def test_rate_limit_per_user_isolation(client, auth_headers, issue_access_token, second_user, monkeypatch):
    async def fake_create_message(**kwargs):
        return _message_row(text=kwargs["text"], user_id=kwargs["user_id"])

    counters = {}

    async def strict_enforce(*, identity: str, **kwargs):
        counters[identity] = counters.get(identity, 0) + 1
        if counters[identity] > 1:
            raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "limited"})

    second_headers = {
        "Authorization": f"Bearer {issue_access_token(second_user['id'], second_user['workspace_id'])}"
    }

    monkeypatch.setattr("app.routers.messages.message_service.create_message", fake_create_message)
    monkeypatch.setattr("app.middleware.rate_limit.rate_limiter.enforce", strict_enforce)

    first_ok = client.post("/messages", headers=auth_headers, json={"channel_id": CHANNEL_ID, "text": "a"})
    first_limited = client.post("/messages", headers=auth_headers, json={"channel_id": CHANNEL_ID, "text": "b"})
    second_ok = client.post("/messages", headers=second_headers, json={"channel_id": CHANNEL_ID, "text": "c"})

    assert first_ok.status_code == 201
    assert first_limited.status_code == 429
    assert second_ok.status_code == 201
