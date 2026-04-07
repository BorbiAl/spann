"""Message routes for send, history, edit, delete, and reactions."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse

from app.database import db
from app.middleware.rate_limit import messages_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.message import EditMessageRequest, MessageResponse, MessagesPageResponse, ReactionRequest, ReactionSummary, SendMessageRequest
from app.services import message_service
from app.services.redis_publisher import RedisPublisher, get_redis_publisher
from app.tasks.coaching import trigger_coaching_task
from app.tasks.sentiment import score_single_channel_task

router = APIRouter(tags=["messages"])
logger = logging.getLogger(__name__)


def _message_not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={
            "code": "message_not_found",
            "error_code": "message_not_found",
            "message": "Message does not exist or has been deleted",
        },
    )


@router.post("/messages")
async def create_message(
    payload: SendMessageRequest,
    request: Request,
    redis_publisher: RedisPublisher = Depends(get_redis_publisher),
    _rate_limit: None = Depends(messages_rate_limit_dependency),
) -> JSONResponse:
    """Create a message, publish websocket event, and fan out async tasks."""

    user_id = str(request.state.user_id)
    channel = await db.get_channel(str(payload.channel_id))
    if channel is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "channel_not_found",
                "error_code": "channel_not_found",
                "message": "Channel does not exist",
            },
        )

    workspace_id = str(channel.get("workspace_id"))
    await db.verify_workspace_access(
        user_id=UUID(user_id),
        workspace_id=UUID(workspace_id),
        required_role="member",
    )

    message = await message_service.create_message(
        db=db,
        user_id=user_id,
        channel_id=str(payload.channel_id),
        workspace_id=workspace_id,
        text=payload.text,
        mesh_origin=payload.mesh_origin,
        source_locale=payload.source_locale,
    )

    response_model = MessageResponse.model_validate(message)

    await redis_publisher.publish(
        f"messages:{response_model.channel_id}",
        {
            "event": "message:new",
            "id": str(response_model.id),
            "channel_id": str(response_model.channel_id),
            "workspace_id": str(response_model.workspace_id),
            "user": {
                "id": str(response_model.user.id),
                "name": response_model.user.name,
                "initials": response_model.user.initials,
                "color": response_model.user.color,
            },
            "text": response_model.text,
            "source_locale": response_model.source_locale,
            "mesh_origin": response_model.mesh_origin,
            "created_at": response_model.created_at.isoformat(),
        },
    )

    preferences = await db.get_user_preferences(user_id)
    trigger_coaching_task(
        message_id=str(response_model.id),
        text=response_model.text,
        channel_tone=str(channel.get("tone", "neutral")),
        user_locale=str(preferences.get("locale", "en-US")),
    )
    score_single_channel_task.delay(str(response_model.channel_id))

    return success_response(response_model.model_dump(mode="json"), status_code=201)


@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: UUID,
    request: Request,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    _rate_limit: None = Depends(messages_rate_limit_dependency),
) -> JSONResponse:
    """Return cursor-paginated messages for one channel."""

    user_id = str(request.state.user_id)
    channel = await db.get_channel(str(channel_id))
    if channel is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "channel_not_found",
                "error_code": "channel_not_found",
                "message": "Channel does not exist",
            },
        )

    await db.verify_workspace_access(
        user_id=UUID(user_id),
        workspace_id=UUID(str(channel.get("workspace_id"))),
        required_role="member",
    )

    messages, has_more, next_cursor = await message_service.get_messages_page(
        db=db,
        channel_id=str(channel_id),
        user_id=user_id,
        cursor=cursor,
        limit=limit,
    )
    message_models = [MessageResponse.model_validate(item) for item in messages]
    page = MessagesPageResponse(messages=message_models, has_more=has_more, next_cursor=next_cursor)
    return success_response(page.model_dump(mode="json"))


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: UUID,
    payload: EditMessageRequest,
    request: Request,
    redis_publisher: RedisPublisher = Depends(get_redis_publisher),
    _rate_limit: None = Depends(messages_rate_limit_dependency),
) -> JSONResponse:
    """Edit one message in-place within the allowed edit window."""

    user_id = str(request.state.user_id)
    updated = await message_service.edit_message(db=db, message_id=str(message_id), user_id=user_id, new_text=payload.text)
    response_model = MessageResponse.model_validate(updated)

    await redis_publisher.publish(
        f"messages:{response_model.channel_id}",
        {
            "event": "message:edited",
            "message_id": str(response_model.id),
            "channel_id": str(response_model.channel_id),
            "new_text": response_model.text,
            "edited_at": response_model.updated_at.isoformat(),
        },
    )

    return success_response(response_model.model_dump(mode="json"))


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: UUID,
    request: Request,
    redis_publisher: RedisPublisher = Depends(get_redis_publisher),
    _rate_limit: None = Depends(messages_rate_limit_dependency),
) -> Response:
    """Soft-delete a message (owner or workspace admin/owner)."""

    user_id = str(request.state.user_id)
    message = await message_service.get_message_by_id(db=db, message_id=str(message_id))
    if message is None:
        raise _message_not_found()

    member = await db.verify_workspace_access(
        user_id=UUID(user_id),
        workspace_id=UUID(str(message["workspace_id"])),
        required_role="member",
    )

    await message_service.soft_delete_message(
        db=db,
        message_id=str(message_id),
        user_id=user_id,
        user_role=member.role,
    )

    await redis_publisher.publish(
        f"messages:{message['channel_id']}",
        {
            "event": "message:deleted",
            "message_id": str(message_id),
            "channel_id": str(message["channel_id"]),
        },
    )

    return Response(status_code=204)


@router.post("/messages/{message_id}/reactions")
async def toggle_message_reaction(
    message_id: UUID,
    payload: ReactionRequest,
    request: Request,
    redis_publisher: RedisPublisher = Depends(get_redis_publisher),
    _rate_limit: None = Depends(messages_rate_limit_dependency),
) -> JSONResponse:
    """Toggle one reaction for the current user and return reaction summary."""

    user_id = str(request.state.user_id)
    message = await message_service.get_message_by_id(db=db, message_id=str(message_id))
    if message is None:
        raise _message_not_found()

    await db.verify_workspace_access(
        user_id=UUID(user_id),
        workspace_id=UUID(str(message["workspace_id"])),
        required_role="member",
    )

    reactions = await message_service.toggle_reaction(
        db=db,
        message_id=str(message_id),
        user_id=user_id,
        emoji=payload.emoji,
    )

    action = "remove"
    for item in reactions:
        if item["emoji"] == payload.emoji and item["reacted_by_me"]:
            action = "add"
            break

    await redis_publisher.publish(
        f"messages:{message['channel_id']}",
        {
            "event": "message:reaction",
            "message_id": str(message_id),
            "emoji": payload.emoji,
            "user_id": user_id,
            "action": action,
        },
    )

    payload_rows = [ReactionSummary.model_validate(item).model_dump(mode="json") for item in reactions]
    return success_response(payload_rows)
