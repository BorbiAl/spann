"""Message understanding endpoint — simplify, explain, detect idioms."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.middleware.rate_limit import translate_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.understand import UnderstandRequest
from app.services.understand import analyze_message

router = APIRouter(tags=["understand"])


@router.post("/understand")
async def understand(
    payload: UnderstandRequest,
    request: Request,
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Simplify, explain, and detect idioms in a chat message."""

    try:
        result = await analyze_message(payload)
    except json.JSONDecodeError:
        result = {
            "simplified": payload.message_text,
            "explanation": "Could not process this message right now.",
            "tone_hint": "Neutral",
            "idioms": [],
        }
    except Exception:  # noqa: BLE001
        result = {
            "simplified": payload.message_text,
            "explanation": "Could not process this message right now.",
            "tone_hint": "Neutral",
            "idioms": [],
        }

    return success_response(result)
