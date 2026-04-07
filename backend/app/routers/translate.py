"""Translation endpoint routes."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.middleware.rate_limit import translate_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.translate import TranslateRequest
from app.services.translation import translate_culturally

router = APIRouter(tags=["translate"])


@router.post("/translate")
async def translate(
    payload: TranslateRequest,
    request: Request,
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Translate and culturally adapt text for a target audience."""

    try:
        result = await translate_culturally(payload)
    except json.JSONDecodeError:
        result = {
            "literal": payload.phrase,
            "cultural": payload.phrase,
            "explanation": "Translation fallback applied due to malformed provider response.",
        }
    except Exception:  # noqa: BLE001
        result = {
            "literal": payload.phrase,
            "cultural": payload.phrase,
            "explanation": "Translation fallback applied while provider is unavailable.",
        }

    return success_response(result)
