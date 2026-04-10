"""Message service layer for persistence and business rules."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.config import settings
from app.services.local_store import local_store


MessageRow = dict[str, Any]


def _use_local_channel(channel_id: str) -> bool:
    return settings.test_mode or (settings.auth_fallback_enabled and channel_id in local_store.channels)


def _use_local_message(message_id: str) -> bool:
    return settings.test_mode or (settings.auth_fallback_enabled and message_id in local_store.messages)


def _http_error(status_code: int, error_code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "code": error_code,
            "error_code": error_code,
            "message": message,
        },
    )


def encode_cursor(message_id: str, created_at: datetime) -> str:
    payload = {"id": message_id, "created_at": created_at.isoformat()}
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def decode_cursor(cursor: str) -> tuple[str, datetime]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return payload["id"], datetime.fromisoformat(payload["created_at"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_cursor",
                "error_code": "invalid_cursor",
                "message": "Cursor is malformed or tampered",
            },
        ) from exc


def _extract_data(result: Any) -> Any:
    return getattr(result, "data", result)


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _build_initials(name: str) -> str:
    parts = [part for part in name.strip().split() if part]
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


def _normalize_user_blob(row: dict[str, Any]) -> dict[str, Any]:
    user_obj = row.get("users") or row.get("user") or {}
    if isinstance(user_obj, list):
        user_obj = user_obj[0] if user_obj else {}

    user_name = str(user_obj.get("name") or user_obj.get("display_name") or "Unknown")
    user_id = user_obj.get("id") or row.get("user_id")

    return {
        "id": str(user_id),
        "name": user_name,
        "initials": str(user_obj.get("initials") or _build_initials(user_name)),
        "color": str(user_obj.get("color") or "#6b7280"),
    }


def _normalize_reactions(reaction_rows: list[dict[str, Any]], *, requesting_user_id: str) -> list[dict[str, Any]]:
    by_emoji: dict[str, dict[str, Any]] = {}
    for reaction in reaction_rows:
        emoji = str(reaction.get("emoji") or "").strip()
        if not emoji:
            continue
        if emoji not in by_emoji:
            by_emoji[emoji] = {"emoji": emoji, "count": 0, "reacted_by_me": False}
        by_emoji[emoji]["count"] += 1
        if str(reaction.get("user_id")) == requesting_user_id:
            by_emoji[emoji]["reacted_by_me"] = True
    return sorted(by_emoji.values(), key=lambda item: item["emoji"])


def _row_to_message_response(row: dict[str, Any], *, requesting_user_id: str) -> MessageRow:
    reaction_rows = row.get("message_reactions") or row.get("reactions") or []
    if not isinstance(reaction_rows, list):
        reaction_rows = []
    edit_rows = row.get("message_edits") or []
    if not isinstance(edit_rows, list):
        edit_rows = []

    return {
        "id": row.get("id"),
        "channel_id": row.get("channel_id"),
        "user_id": row.get("user_id"),
        "workspace_id": row.get("workspace_id"),
        "text": "[deleted]" if row.get("deleted_at") else row.get("text"),
        "text_translated": row.get("text_translated"),
        "source_locale": row.get("source_locale"),
        "sentiment_score": row.get("sentiment_score"),
        "mesh_origin": bool(row.get("mesh_origin", False)),
        "deleted_at": row.get("deleted_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at") or row.get("created_at"),
        "user": _normalize_user_blob(row),
        "reactions": _normalize_reactions(reaction_rows, requesting_user_id=requesting_user_id),
        "is_edited": bool(edit_rows),
    }


async def _get_raw_message(db: Any, message_id: str) -> MessageRow | None:
    if _use_local_message(message_id):
        return local_store.get_message(message_id)

    client = await db.client()
    response = await db._execute(  # noqa: SLF001
        "message_service_get_raw_message",
        client.table("messages")
        .select(
            "id,channel_id,user_id,workspace_id,text,text_translated,source_locale,"
            "sentiment_score,mesh_origin,deleted_at,created_at,updated_at"
        )
        .eq("id", message_id)
        .limit(1),
    )
    rows = _extract_data(response) or []
    return rows[0] if rows else None


async def create_message(
    db: Any,
    user_id: str,
    channel_id: str,
    workspace_id: str,
    text: str,
    text_translated: str | None,
    mesh_origin: bool,
    source_locale: str | None,
) -> MessageRow:
    if _use_local_channel(channel_id):
        created = local_store.create_message(
            channel_id=channel_id,
            user_id=user_id,
            workspace_id=workspace_id,
            text=text.strip(),
            text_translated=text_translated,
            mesh_origin=bool(mesh_origin),
            source_locale=source_locale,
        )
        full_message = await get_message_by_id(db, str(created["id"]))
        if full_message is None:
            raise _http_error(404, "message_not_found", "Message does not exist or has been deleted")
        return full_message

    client = await db.client()
    now = datetime.now(UTC)
    payload = {
        "id": str(uuid4()),
        "channel_id": channel_id,
        "user_id": user_id,
        "workspace_id": workspace_id,
        "text": text.strip(),
        "text_translated": text_translated.strip() if isinstance(text_translated, str) and text_translated.strip() else None,
        "source_locale": source_locale,
        "sentiment_score": None,
        "mesh_origin": bool(mesh_origin),
        "deleted_at": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    response = await db._execute("message_service_create_message", client.table("messages").insert(payload))  # noqa: SLF001
    rows = _extract_data(response) or []
    created = rows[0] if rows else payload

    full_message = await get_message_by_id(db, str(created["id"]))
    if full_message is None:
        raise _http_error(404, "message_not_found", "Message does not exist or has been deleted")
    return full_message


# Canonical SQL shape for message pagination, mirrored by the PostgREST select below.
MESSAGES_PAGE_QUERY = """
SELECT
  m.id, m.channel_id, m.user_id, m.workspace_id,
  m.text, m.text_translated, m.source_locale,
  m.sentiment_score, m.mesh_origin,
  m.deleted_at, m.created_at, m.updated_at,
  u.id as u_id, u.name as u_name, u.color as u_color,
  COALESCE(
    json_agg(
      json_build_object('emoji', r.emoji, 'user_id', r.user_id)
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'
  ) as reactions,
  EXISTS(SELECT 1 FROM message_edits e WHERE e.message_id = m.id) as is_edited
FROM messages m
JOIN users u ON u.id = m.user_id
LEFT JOIN message_reactions r ON r.message_id = m.id
WHERE m.channel_id = :channel_id
  AND (
    :cursor_created_at IS NULL
    OR (m.created_at, m.id) < (:cursor_created_at, :cursor_id)
  )
GROUP BY m.id, u.id
ORDER BY m.created_at DESC, m.id DESC
LIMIT :limit
"""


async def get_messages_page(db: Any, channel_id: str, user_id: str, cursor: str | None, limit: int) -> tuple[list[MessageRow], bool, str | None]:
    safe_limit = max(1, min(int(limit), 100))

    cursor_id: str | None = None
    cursor_created_at: datetime | None = None
    if cursor:
        cursor_id, cursor_created_at = decode_cursor(cursor)

    if _use_local_channel(channel_id):
        rows = local_store.list_messages_page(
            channel_id=channel_id,
            cursor_id=cursor_id,
            cursor_created_at=cursor_created_at,
            limit_plus_one=safe_limit + 1,
        )
        has_more = len(rows) > safe_limit
        page_rows = rows[:safe_limit]
        next_cursor: str | None = None
        if has_more and page_rows:
            tail = page_rows[-1]
            next_cursor = encode_cursor(str(tail["id"]), _parse_datetime(tail["created_at"]))
        messages = [_row_to_message_response(row, requesting_user_id=user_id) for row in page_rows]
        return messages, has_more, next_cursor

    client = await db.client()

    query = (
        client.table("messages")
        .select(
            "id,channel_id,user_id,workspace_id,text,text_translated,source_locale,"
            "sentiment_score,mesh_origin,deleted_at,created_at,updated_at,"
            "users(id,name,display_name,color),"
            "message_reactions(id,emoji,user_id),"
            "message_edits(message_id)"
        )
        .eq("channel_id", channel_id)
        .order("created_at", desc=True)
        .order("id", desc=True)
        .limit(safe_limit + 1)
    )

    if cursor_id and cursor_created_at is not None:
        cursor_iso = cursor_created_at.astimezone(UTC).isoformat()
        query = query.or_(
            f"created_at.lt.{cursor_iso},and(created_at.eq.{cursor_iso},id.lt.{cursor_id})"
        )

    response = await db._execute("message_service_get_messages_page", query)  # noqa: SLF001
    rows = _extract_data(response) or []

    has_more = len(rows) > safe_limit
    page_rows = rows[:safe_limit]
    next_cursor: str | None = None

    if has_more and page_rows:
        tail = page_rows[-1]
        next_cursor = encode_cursor(str(tail["id"]), _parse_datetime(tail["created_at"]))

    messages = [_row_to_message_response(row, requesting_user_id=user_id) for row in page_rows]
    return messages, has_more, next_cursor


async def edit_message(db: Any, message_id: str, user_id: str, new_text: str) -> MessageRow:
    existing = await verify_message_ownership(db, message_id, user_id)

    if existing.get("deleted_at") is not None:
        raise _http_error(409, "message_deleted", "Deleted messages cannot be edited")

    created_at = _parse_datetime(existing.get("created_at"))
    if datetime.now(UTC) - created_at > timedelta(seconds=300):
        raise _http_error(409, "edit_window_expired", "Message edit window has expired")

    if _use_local_message(message_id):
        local_store.add_message_edit(
            message_id=message_id,
            edited_by=user_id,
            previous_text=str(existing.get("text") or ""),
            new_text=new_text.strip(),
        )
        local_store.update_message_text(message_id=message_id, new_text=new_text.strip())
    else:
        client = await db.client()
        now = datetime.now(UTC)

        await db._execute(  # noqa: SLF001
            "message_service_create_edit_history",
            client.table("message_edits").insert(
                {
                    "id": str(uuid4()),
                    "message_id": message_id,
                    "edited_by": user_id,
                    "previous_text": str(existing.get("text") or ""),
                    "new_text": new_text.strip(),
                    "edited_at": now.isoformat(),
                }
            ),
        )

        await db._execute(  # noqa: SLF001
            "message_service_update_message_text",
            client.table("messages")
            .update({"text": new_text.strip(), "updated_at": now.isoformat()})
            .eq("id", message_id),
        )

    updated = await get_message_by_id(db, message_id)
    if updated is None:
        raise _http_error(404, "message_not_found", "Message does not exist or has been deleted")
    return updated


async def soft_delete_message(db: Any, message_id: str, user_id: str, user_role: str) -> None:
    existing = await _get_raw_message(db, message_id)
    if existing is None:
        raise _http_error(404, "message_not_found", "Message does not exist or has been deleted")

    is_owner = str(existing.get("user_id")) == str(user_id)
    can_moderate = str(user_role).lower() in {"admin", "owner"}
    if not is_owner and not can_moderate:
        raise _http_error(403, "forbidden", "You are not allowed to delete this message")

    if existing.get("deleted_at") is not None:
        return

    if _use_local_message(message_id):
        local_store.soft_delete_message(message_id=message_id)
    else:
        client = await db.client()
        now = datetime.now(UTC).isoformat()
        await db._execute(  # noqa: SLF001
            "message_service_soft_delete",
            client.table("messages").update({"deleted_at": now, "updated_at": now}).eq("id", message_id),
        )


async def toggle_reaction(db: Any, message_id: str, user_id: str, emoji: str) -> list[dict[str, Any]]:
    message = await _get_raw_message(db, message_id)
    if message is None:
        raise _http_error(404, "message_not_found", "Message does not exist or has been deleted")
    if message.get("deleted_at") is not None:
        raise _http_error(409, "message_deleted", "Deleted messages cannot receive reactions")

    cleaned_emoji = emoji.strip()
    if _use_local_message(message_id):
        local_store.toggle_reaction(message_id=message_id, user_id=user_id, emoji=cleaned_emoji)
        reaction_rows = local_store.list_reactions(message_id=message_id)
    else:
        client = await db.client()

        existing_response = await db._execute(  # noqa: SLF001
            "message_service_reaction_lookup",
            client.table("message_reactions")
            .select("id")
            .eq("message_id", message_id)
            .eq("user_id", user_id)
            .eq("emoji", cleaned_emoji)
            .limit(1),
        )
        existing_rows = _extract_data(existing_response) or []

        if existing_rows:
            await db._execute(  # noqa: SLF001
                "message_service_reaction_delete",
                client.table("message_reactions").delete().eq("id", str(existing_rows[0]["id"])),
            )
        else:
            await db._execute(  # noqa: SLF001
                "message_service_reaction_insert",
                client.table("message_reactions").insert(
                    {
                        "id": str(uuid4()),
                        "message_id": message_id,
                        "user_id": user_id,
                        "emoji": cleaned_emoji,
                        "created_at": datetime.now(UTC).isoformat(),
                    }
                ),
            )

        reactions_response = await db._execute(  # noqa: SLF001
            "message_service_reaction_list",
            client.table("message_reactions").select("emoji,user_id").eq("message_id", message_id),
        )
        reaction_rows = _extract_data(reactions_response) or []

    return _normalize_reactions(reaction_rows, requesting_user_id=user_id)


async def get_message_by_id(db: Any, message_id: str) -> MessageRow | None:
    if _use_local_message(message_id):
        row = local_store.get_message_with_relations(message_id)
        if row is None:
            return None
        return _row_to_message_response(row, requesting_user_id=str(row.get("user_id") or ""))

    client = await db.client()
    response = await db._execute(  # noqa: SLF001
        "message_service_get_message_by_id",
        client.table("messages")
        .select(
            "id,channel_id,user_id,workspace_id,text,text_translated,source_locale,"
            "sentiment_score,mesh_origin,deleted_at,created_at,updated_at,"
            "users(id,name,display_name,color),"
            "message_reactions(id,emoji,user_id),"
            "message_edits(message_id)"
        )
        .eq("id", message_id)
        .limit(1),
    )
    rows = _extract_data(response) or []
    if not rows:
        return None

    row = rows[0]
    return _row_to_message_response(row, requesting_user_id=str(row.get("user_id") or ""))


async def verify_message_ownership(db: Any, message_id: str, user_id: str) -> MessageRow:
    message = await _get_raw_message(db, message_id)
    if message is None:
        raise _http_error(404, "message_not_found", "Message does not exist or has been deleted")

    if str(message.get("user_id")) != str(user_id):
        raise _http_error(403, "forbidden", "You do not own this message")

    return message
