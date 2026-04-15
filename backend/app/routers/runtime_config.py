"""Public runtime configuration routes for frontend bootstrapping."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas.common import success_response

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/public")
async def get_public_runtime_config() -> JSONResponse:
    """Return non-sensitive frontend runtime configuration."""

    return success_response(settings.public_runtime_config)
