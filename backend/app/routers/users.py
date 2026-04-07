"""User profile and preference routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.database import db
from app.middleware.rate_limit import public_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.user import UserPreferencesPatchRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me/preferences")
async def patch_me_preferences(
    payload: UserPreferencesPatchRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Update authenticated user's locale, accessibility, and coaching settings."""

    user_id = request.state.user_id
    updated = await db.update_user_preferences(
        user_id=user_id,
        locale=payload.locale,
        coaching_enabled=payload.coaching_enabled,
        accessibility_settings=payload.accessibility_settings,
    )
    return success_response(updated)
