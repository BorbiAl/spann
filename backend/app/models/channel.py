"""Channel domain model."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChannelModel(BaseModel):
    """Represents a channel within a workspace."""

    model_config = ConfigDict(extra="allow")

    id: str
    workspace_id: str
    name: str
    description: str | None = None
    tone: str = "neutral"
    created_by: str
    created_at: datetime | None = None
