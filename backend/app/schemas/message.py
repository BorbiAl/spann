"""Message API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageCreateRequest(BaseModel):
    """Payload for creating a new channel message."""

    model_config = ConfigDict(extra="forbid")

    channel_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    """Normalized message response."""

    id: str
    channel_id: str
    user_id: str
    text: str
    translated: str | None = None
    sentiment_score: float = 0.0
    mesh_origin: bool = False
    created_at: datetime | None = None


class PaginatedMessagesResponse(BaseModel):
    """Cursor-based pagination response for message history."""

    messages: list[MessageResponse]
    next_cursor: str | None = None
