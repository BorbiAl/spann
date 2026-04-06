"""Mesh relay synchronization endpoints."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from fastapi import APIRouter

from app.database import db
from app.schemas.common import success_response

router = APIRouter(prefix="/mesh", tags=["mesh"])


class MeshSyncRequest(BaseModel):
    """Batch payload for mesh relay delivery synchronization."""

    model_config = ConfigDict(extra="forbid")

    messages: list[dict] = Field(default_factory=list, max_length=200)


@router.post("/sync")
async def sync_mesh_messages(payload: MeshSyncRequest):
    """Persist delivered mesh messages for backend reconciliation."""

    synced = await db.sync_mesh_messages(payload.messages)
    return success_response({"synced": synced}, status_code=201)
