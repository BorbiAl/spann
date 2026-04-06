"""Message domain model."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MessageModel(BaseModel):
    """Represents a message sent in a channel."""

    model_config = ConfigDict(extra="allow")

    id: str
    channel_id: str
    user_id: str
    text: str
    translated: str | None = None
    sentiment_score: float = 0.0
    mesh_origin: bool = False
    created_at: datetime | None = None
