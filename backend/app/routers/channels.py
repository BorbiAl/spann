"""Channel CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

from app.database import db
from app.middleware.rate_limit import public_rate_limit_dependency
from app.schemas.common import success_response

router = APIRouter(tags=["channels"])


class ChannelCreateRequest(BaseModel):
    """Payload for channel creation."""

    model_config = ConfigDict(extra="forbid")

    workspace_id: UUID
    name: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")
    description: str | None = Field(default=None, max_length=500)
    tone: str = Field(default="neutral", min_length=2, max_length=64)
    is_private: bool = False


@router.get("/channels")
async def list_channels(
    workspace_id: UUID,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """List channels for the specified workspace."""

    user_id = UUID(str(request.state.user_id))
    await db.verify_workspace_access(user_id=user_id, workspace_id=workspace_id, required_role="member")

    rows = await db.list_channels(str(workspace_id))
    return success_response(rows)


@router.post("/channels")
async def create_channel(
    payload: ChannelCreateRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Create a new channel under a workspace."""

    user_id = str(request.state.user_id)
    await db.verify_workspace_access(user_id=UUID(user_id), workspace_id=payload.workspace_id, required_role="member")

    channel = await db.create_channel(
        workspace_id=str(payload.workspace_id),
        name=payload.name,
        description=payload.description,
        tone=payload.tone,
        created_by=user_id,
        is_private=payload.is_private,
    )
    return success_response(channel, status_code=201)
