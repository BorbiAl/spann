"""Common API response schema helpers."""

from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict


class ErrorBody(BaseModel):
    """Structured API error payload."""

    model_config = ConfigDict(extra="allow")

    code: str
    message: str
    details: dict[str, Any] | None = None


class ResponseEnvelope(BaseModel):
    """Response envelope that wraps every API response."""

    data: Any | None
    error: ErrorBody | None
    status: int


def success_response(data: Any, status_code: int = 200) -> JSONResponse:
    """Create a success response envelope."""
    content: dict[str, Any] = {"data": data, "error": None, "status": status_code}
    if isinstance(data, dict):
        for key, value in data.items():
            if key not in {"data", "error", "status"}:
                content[key] = value
    return JSONResponse(status_code=status_code, content=content)


def error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Create a standardized error response envelope."""
    detail = {"error_code": code, "message": message, "details": details}
    return JSONResponse(
        status_code=status_code,
        headers=headers,
        content={
            "data": None,
            "error": {"code": code, "message": message, "details": details},
            "detail": detail,
            "status": status_code,
        },
    )
