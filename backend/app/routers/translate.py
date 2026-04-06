"""Translation endpoint routes."""

from __future__ import annotations

import json

from fastapi import APIRouter, Request

from app.config import settings
from app.middleware.rate_limit import rate_limiter
from app.schemas.common import error_response, success_response
from app.schemas.translate import TranslateRequest
from app.services.translation import translate_culturally

router = APIRouter(tags=["translate"])


@router.post("/translate")
async def translate(payload: TranslateRequest, request: Request):
    """Translate and culturally adapt text for a target audience."""

    user_id = request.state.user_id
    await rate_limiter.enforce(
        identity=user_id,
        bucket="translate",
        limit=settings.translate_rate_limit_per_minute,
    )

    try:
        result = await translate_culturally(payload)
    except json.JSONDecodeError:
        return error_response(
            status_code=500,
            code="INVALID_AI_RESPONSE",
            message="Translation provider returned malformed JSON output.",
        )
    except Exception as exc:  # noqa: BLE001
        return error_response(
            status_code=500,
            code="TRANSLATION_FAILED",
            message=f"Translation failed: {exc}",
        )

    return success_response(result)
