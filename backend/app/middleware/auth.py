"""JWT authentication and request-id propagation middleware."""

from __future__ import annotations

import logging
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
    "/auth/login",
    "/auth/magic-link",
    "/docs",
    "/redoc",
    "/openapi.json",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate JWT tokens for all protected API endpoints."""

    async def dispatch(self, request: Request, call_next) -> Response:
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
            return error_response(
                status_code=401,
                code="UNAUTHORIZED",
                message="Missing or invalid Bearer token.",
            )

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return error_response(
                status_code=401,
                code="UNAUTHORIZED",
                message="Authorization token cannot be empty.",
            )

        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except jwt.ExpiredSignatureError:
            return error_response(status_code=401, code="TOKEN_EXPIRED", message="Authentication token expired.")
        except jwt.InvalidTokenError as exc:
            logger.warning("invalid_jwt", extra={"error": str(exc), "request_id": request_id})
            return error_response(status_code=401, code="INVALID_TOKEN", message="Authentication token is invalid.")

        user_id = payload.get("sub")
        if not user_id:
            return error_response(status_code=401, code="INVALID_TOKEN", message="Token subject is missing.")

        request.state.auth = payload
        request.state.user_id = str(user_id)

        response = await call_next(request)
        response.headers[settings.request_id_header] = request_id
        return response
