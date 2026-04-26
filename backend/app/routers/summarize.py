"""Thread summarization endpoint."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.database import db
from app.middleware.rate_limit import translate_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.summarize import SummarizeResponse
from app.services.redis_client import redis_client
from app.services.summarize import summarize_thread

router = APIRouter(tags=["summarize"])
logger = logging.getLogger(__name__)

_CACHE_TTL = 300  # 5 minutes
_MAX_MESSAGES = 30


def _cache_key(channel_id: str, last_msg_id: str) -> str:
    return f"summary:{channel_id}:{last_msg_id}"


@router.post("/channels/{channel_id}/summarize")
async def summarize_channel(
    channel_id: str,
    request: Request,
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Summarize the most recent messages in a channel.

    Returns bullet points, key decisions, and action items.
    Results are cached in Redis for 5 minutes keyed by (channel_id, last_msg_id).
    """
    user_id = request.state.user_id

    # Verify channel exists and user has access
    channel = await db.get_channel(channel_id)
    if channel is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "channel_not_found", "message": "Channel does not exist"},
        )

    from uuid import UUID
    workspace_id = str(channel.get("workspace_id", ""))
    if workspace_id:
        try:
            await db.verify_workspace_access(
                user_id=UUID(str(user_id)),
                workspace_id=UUID(workspace_id),
                required_role="member",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("summarize_access_check_failed", extra={"error": str(exc)})
            raise HTTPException(
                status_code=403,
                detail={"code": "forbidden", "message": "Access denied"},
            ) from exc

    # Fetch recent messages
    messages = await db.get_last_n_messages(channel_id, n=_MAX_MESSAGES)
    if not messages:
        return success_response(
            SummarizeResponse(bullets=[], decisions=[], action_items=[], message_count=0, cached=False).model_dump()
        )

    # Cache check: key on last message id
    last_msg_id = str(messages[-1].get("id", ""))
    cache_key = _cache_key(channel_id, last_msg_id)

    try:
        cached_raw = await redis_client.get_json(cache_key)
        if cached_raw:
            cached = json.loads(cached_raw)
            cached["cached"] = True
            return success_response(cached)
    except Exception as exc:  # noqa: BLE001
        logger.warning("summarize_cache_read_failed", extra={"error": str(exc)})

    # Generate summary
    result = await summarize_thread(messages)

    # Store in cache
    try:
        await redis_client.set_json(cache_key, json.dumps(result.model_dump()), ex_seconds=_CACHE_TTL)
    except Exception as exc:  # noqa: BLE001
        logger.warning("summarize_cache_write_failed", extra={"error": str(exc)})

    return success_response(result.model_dump())
