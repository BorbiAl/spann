"""User profile and preference routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.database import db
from app.middleware.rate_limit import public_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.user import UserPreferencesPatchRequest, UserProfilePatchRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Return the authenticated user's profile."""

    user_id = request.state.user_id
    profile = await db.get_user_profile(user_id=user_id)
    if profile is None:
        return JSONResponse(status_code=404, content={"detail": {"error_code": "user_not_found", "message": "User not found."}})
    return success_response(profile)


@router.patch("/me")
async def patch_me(
    payload: UserProfilePatchRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Update the authenticated user's profile (display_name, bio, timezone)."""

    user_id = request.state.user_id
    updated = await db.update_user_profile(
        user_id=user_id,
        display_name=payload.display_name,
        bio=payload.bio,
        timezone=payload.timezone,
        avatar_url=payload.avatar_url,
    )

    if updated is None:
        resolved_email = await db.resolve_user_email(user_id=user_id, fallback_email=payload.email)
        if resolved_email:
            bootstrap_name = payload.display_name or resolved_email.split("@", 1)[0]
            await db.upsert_user_profile(
                user_id=user_id,
                email=resolved_email,
                display_name=bootstrap_name,
                locale="en-US",
            )
            updated = await db.update_user_profile(
                user_id=user_id,
                display_name=payload.display_name,
                bio=payload.bio,
                timezone=payload.timezone,
                avatar_url=payload.avatar_url,
            )

    if updated is None:
        return JSONResponse(status_code=404, content={"detail": {"error_code": "user_not_found", "message": "User not found."}})
    return success_response(updated)


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
