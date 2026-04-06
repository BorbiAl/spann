"""Channel CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from app.database import db
from app.schemas.common import error_response, success_response

router = APIRouter(tags=["channels"])


class ChannelCreateRequest(BaseModel):
    """Payload for channel creation."""

    model_config = ConfigDict(extra="forbid")

    workspace_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    tone: str = Field(default="neutral", min_length=2, max_length=64)


@router.get("/channels")
async def list_channels(workspace_id: str, request: Request):
    """List channels for the specified workspace."""

    if not workspace_id.strip():
        return error_response(status_code=400, code="BAD_REQUEST", message="workspace_id is required.")

    rows = await db.list_channels(workspace_id)
    return success_response(rows)


@router.post("/channels")
async def create_channel(payload: ChannelCreateRequest, request: Request):
    """Create a new channel under a workspace."""

    user_id = request.state.user_id
    channel = await db.create_channel(
        workspace_id=payload.workspace_id,
        name=payload.name,
        description=payload.description,
        tone=payload.tone,
        created_by=user_id,
    )
    return success_response(channel, status_code=201)
