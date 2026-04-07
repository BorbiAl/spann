"""Pulse sentiment routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from uuid import UUID

from app.database import db
from app.middleware.rate_limit import public_rate_limit_dependency
from app.schemas.common import error_response, success_response

router = APIRouter(prefix="/pulse", tags=["pulse"])


@router.get("/{channel_id}")
async def get_channel_pulse(
    channel_id: UUID,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Return the latest pulse score and label for a channel."""

    snapshot = await db.get_pulse_snapshot(str(channel_id))
    if snapshot is None:
        return error_response(
            status_code=404,
            code="PULSE_NOT_FOUND",
            message="No sentiment pulse is available for this channel yet.",
        )
    return success_response(snapshot)
