"""Authentication routes for login, refresh-token rotation, and logout."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_hex
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import db
from app.middleware.rate_limit import auth_rate_limit_dependency
from app.schemas.common import error_response, success_response
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest
from app.schemas.user import MagicLinkRequest

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_TOKEN_TTL_MINUTES = 15
REFRESH_TOKEN_TTL_DAYS = 30


def _hash_refresh_token(token: str) -> str:
    """Return stable SHA-256 digest for refresh token storage."""

    return sha256(token.encode("utf-8")).hexdigest()


def _build_access_token(*, user_id: str, workspace_id: str) -> tuple[str, int]:
    """Create a signed short-lived JWT access token for API authentication."""

    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES)
    payload = {
        "sub": user_id,
        "workspace_id": workspace_id,
        "jti": str(uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int((expires_at - now).total_seconds())


def _build_refresh_token() -> tuple[str, str]:
    """Generate cryptographically-random refresh token and its hash."""

    raw = token_hex(64)
    return raw, _hash_refresh_token(raw)


@router.post("/login")
async def login(payload: LoginRequest, request: Request, _rate_limit: None = Depends(auth_rate_limit_dependency)) -> JSONResponse:
    """Authenticate credentials and issue a rotated token pair."""

    auth_result = await db.authenticate_user(payload.email, payload.password)
    if auth_result is None:
        return error_response(status_code=401, code="INVALID_CREDENTIALS", message="Email or password is incorrect.")

    user = auth_result["user"]
    workspace_id = await db.get_default_workspace_for_user(user["id"])
    if workspace_id is None:
        return error_response(
            status_code=403,
            code="not_workspace_member",
            message="User is not a member of any workspace.",
        )

    access_token, expires_in = _build_access_token(user_id=user["id"], workspace_id=workspace_id)
    refresh_token, refresh_hash = _build_refresh_token()

    await db.create_refresh_token(
        user_id=user["id"],
        token_hash=refresh_hash,
        workspace_id=workspace_id,
        expires_at=(datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_TTL_DAYS)),
        device_hint=payload.device_hint,
    )

    return success_response(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",  # nosec B105 - OAuth token type literal, not a secret.
            "expires_in": expires_in,
            "user": user,
            "supabase_access_token": auth_result.get("supabase_access_token"),
        },
        status_code=200,
    )


@router.post("/refresh")
async def refresh(payload: RefreshRequest, request: Request, _rate_limit: None = Depends(auth_rate_limit_dependency)) -> JSONResponse:
    """Rotate refresh token and issue a fresh access/refresh pair."""

    old_token_hash = _hash_refresh_token(payload.refresh_token)
    old_row = await db.get_refresh_token_by_hash(old_token_hash)
    if old_row is None:
        return error_response(status_code=401, code="invalid_refresh_token", message="Refresh token is invalid.")

    if bool(old_row.get("revoked")):
        await db.revoke_all_refresh_tokens_for_user(str(old_row.get("user_id")))
        return error_response(
            status_code=401,
            code="token_reuse_detected",
            message="Refresh token reuse detected. All sessions have been invalidated.",
        )

    expires_at = old_row.get("expires_at")
    if not isinstance(expires_at, str):
        return error_response(status_code=401, code="invalid_refresh_token", message="Refresh token is invalid.")

    expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    if expiry <= datetime.now(UTC):
        await db.revoke_refresh_token(old_token_hash)
        return error_response(status_code=401, code="refresh_token_expired", message="Refresh token has expired.")

    user_id = str(old_row["user_id"])
    workspace_id = str(old_row["workspace_id"])

    new_refresh_token, new_refresh_hash = _build_refresh_token()
    access_token, expires_in = _build_access_token(user_id=user_id, workspace_id=workspace_id)

    rotate_ok = await db.rotate_refresh_token(
        old_token_hash=old_token_hash,
        new_token_hash=new_refresh_hash,
        user_id=user_id,
        workspace_id=workspace_id,
        expires_at=(datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_TTL_DAYS)),
        device_hint=old_row.get("device_hint"),
    )
    if not rotate_ok:
        return error_response(
            status_code=401,
            code="refresh_rotation_failed",
            message="Refresh token rotation failed.",
        )

    return success_response(
        {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",  # nosec B105 - OAuth token type literal, not a secret.
            "expires_in": expires_in,
        }
    )


@router.post("/logout")
async def logout(payload: LogoutRequest, request: Request) -> JSONResponse:
    """Revoke supplied refresh token for the authenticated user."""

    user_id = str(request.state.user_id)
    token_hash = _hash_refresh_token(payload.refresh_token)

    token_row = await db.get_refresh_token_by_hash(token_hash)
    if token_row is None:
        return success_response({"revoked": False}, status_code=200)

    if str(token_row.get("user_id")) != user_id:
        return error_response(
            status_code=403,
            code="forbidden_refresh_token",
            message="Refresh token does not belong to the authenticated user.",
        )

    await db.revoke_refresh_token(token_hash)
    return success_response({"revoked": True}, status_code=200)


@router.post("/magic-link")
async def send_magic_link(payload: MagicLinkRequest, request: Request, _rate_limit: None = Depends(auth_rate_limit_dependency)) -> JSONResponse:
    """Send a passwordless sign-in link using Supabase email OTP."""

    await db.send_magic_link(payload.email)
    return success_response(
        {"message": "Magic link sent if the email is registered."},
        status_code=200,
    )
