"""Authentication routes for login and magic-link flows."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter

from app.config import settings
from app.database import db
from app.schemas.common import error_response, success_response
from app.schemas.user import LoginRequest, MagicLinkRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_access_token(*, user_id: str, email: str) -> str:
    """Create a signed JWT access token for API authentication."""

    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_exp_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/login")
async def login(payload: LoginRequest):
    """Authenticate credentials via Supabase Auth and issue API JWT."""

    auth_result = await db.authenticate_user(payload.email, payload.password)
    if auth_result is None:
        return error_response(status_code=401, code="INVALID_CREDENTIALS", message="Email or password is incorrect.")

    user = auth_result["user"]
    token = _build_access_token(user_id=user["id"], email=user["email"])

    return success_response(
        {
            "token": token,
            "token_type": "bearer",
            "expires_in": settings.jwt_exp_minutes * 60,
            "user": user,
            "supabase_access_token": auth_result.get("supabase_access_token"),
        },
        status_code=200,
    )


@router.post("/magic-link")
async def send_magic_link(payload: MagicLinkRequest):
    """Send a passwordless sign-in link using Supabase email OTP."""

    await db.send_magic_link(payload.email)
    return success_response(
        {"message": "Magic link sent if the email is registered."},
        status_code=202,
    )
