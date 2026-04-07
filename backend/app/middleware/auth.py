"""JWT authentication and request-id propagation middleware."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from uuid import uuid4

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings
from app.schemas.common import error_response

logger = logging.getLogger(__name__)

UNPROTECTED_PATHS = {
    "/health",
    "/metrics",
    "/auth/login",
    "/auth/refresh",
    "/auth/magic-link",
    "/mesh/sync",
    "/docs",
    "/redoc",
    "/openapi.json",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate JWT tokens for all protected API endpoints."""

    @staticmethod
    def _error_with_request_id(*, request_id: str, status_code: int, code: str, message: str) -> Response:
        """Build standardized error response while preserving request-id propagation."""

        response = error_response(status_code=status_code, code=code, message=message)
        response.headers[settings.request_id_header] = request_id
        return response

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """Authenticate request and enrich context state before routing."""

        request_id = request.headers.get(settings.request_id_header, str(uuid4()))
        request.state.request_id = request_id

        path = request.url.path
        method = request.method.upper()

        if method == "OPTIONS" or path in UNPROTECTED_PATHS:
            response = await call_next(request)
            response.headers[settings.request_id_header] = request_id
            return response

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return self._error_with_request_id(
                request_id=request_id,
                status_code=401,
                code="UNAUTHORIZED",
                message="Missing or invalid Bearer token.",
            )

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return self._error_with_request_id(
                request_id=request_id,
                status_code=401,
                code="UNAUTHORIZED",
                message="Authorization token cannot be empty.",
            )

        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
                options={"require": ["sub", "iat", "exp"]},
            )
        except jwt.ExpiredSignatureError:
            return self._error_with_request_id(
                request_id=request_id,
                status_code=401,
                code="TOKEN_EXPIRED",
                message="Authentication token expired.",
            )
        except jwt.InvalidTokenError as exc:
            logger.warning("invalid_jwt", extra={"error": str(exc), "request_id": request_id})
            return self._error_with_request_id(
                request_id=request_id,
                status_code=401,
                code="INVALID_TOKEN",
                message="Authentication token is invalid.",
            )

        user_id = payload.get("sub")
        issued_at = payload.get("iat")
        now_ts = int(datetime.now(UTC).timestamp())
        if isinstance(issued_at, int) and issued_at > now_ts + 30:
            return self._error_with_request_id(
                request_id=request_id,
                status_code=401,
                code="INVALID_TOKEN",
                message="Token iat is in the future.",
            )

        if not user_id or not payload.get("jti") or not payload.get("workspace_id"):
            return self._error_with_request_id(
                request_id=request_id,
                status_code=401,
                code="INVALID_TOKEN",
                message="Token claims are incomplete.",
            )

        request.state.auth = payload
        request.state.user_id = str(user_id)

        response = await call_next(request)
        response.headers[settings.request_id_header] = request_id
        return response
