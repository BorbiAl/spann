"""Unified /understand AI endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.middleware.rate_limit import translate_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.understand import UnderstandRequest
from app.services.understand import understand_message

router = APIRouter(tags=["understand"])


@router.post("/understand")
async def understand(
    payload: UnderstandRequest,
    request: Request,
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Analyse a message and return simplified text, idioms, tone, and translation.

    Always succeeds — when the AI is unavailable the original message text
    is echoed back across all fields (fail-open).
    """
    result = await understand_message(
        message_text=payload.message_text,
        user_preferences=payload.user_preferences,
        context=payload.context,
    )
    return success_response(result.model_dump())
