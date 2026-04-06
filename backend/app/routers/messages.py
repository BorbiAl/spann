"""Message creation and history routes."""

from __future__ import annotations

from fastapi import APIRouter, Request
from uuid import UUID

from app.config import settings
from app.database import db
from app.middleware.rate_limit import rate_limiter
from app.schemas.common import error_response, success_response
from app.schemas.message import MessageCreateRequest
from app.tasks.coaching import trigger_coaching_task

router = APIRouter(tags=["messages"])


@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: UUID,
    request: Request,
    cursor: str | None = None,
    limit: int = 25,
):
    """Return cursor-based message history for a channel."""

    user_id = request.state.user_id
    await rate_limiter.enforce(
        identity=user_id,
        bucket="messages",
        limit=settings.messages_rate_limit_per_minute,
    )

    channel_id_text = str(channel_id)
    channel = await db.get_channel(channel_id_text)
    if channel is None:
        return error_response(status_code=404, code="CHANNEL_NOT_FOUND", message="Channel does not exist.")

    data = await db.list_messages(channel_id=channel_id_text, cursor=cursor, limit=limit)
    return success_response(data)


@router.post("/messages")
async def create_message(payload: MessageCreateRequest, request: Request):
    """Create message and trigger asynchronous coaching analysis."""

    user_id = request.state.user_id
    await rate_limiter.enforce(
        identity=user_id,
        bucket="messages",
        limit=settings.messages_rate_limit_per_minute,
    )

    byte_size = len(payload.text.encode("utf-8"))
    if byte_size > settings.max_message_bytes:
        return error_response(
            status_code=422,
            code="MESSAGE_TOO_LARGE",
            message=f"Message size {byte_size} bytes exceeds limit of {settings.max_message_bytes} bytes.",
        )

    channel = await db.get_channel(str(payload.channel_id))
    if channel is None:
        return error_response(status_code=404, code="CHANNEL_NOT_FOUND", message="Channel does not exist.")

    created = await db.create_message(
        channel_id=str(payload.channel_id),
        user_id=user_id,
        text=payload.text,
    )

    prefs = await db.get_user_preferences(user_id)
    trigger_coaching_task(
        message_id=created["id"],
        channel_id=str(payload.channel_id),
        user_id=user_id,
        text=payload.text,
        tone=channel.get("tone", "neutral"),
        locale=prefs.get("locale", "en-US"),
    )

    return success_response(created, status_code=201)
