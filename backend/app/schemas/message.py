"""Message request and response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UserBrief(BaseModel):
    """Compact user metadata embedded in message responses."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str
    initials: str
    color: str


class ReactionSummary(BaseModel):
    """Aggregated reaction information per emoji."""

    model_config = ConfigDict(extra="forbid")

    emoji: str = Field(min_length=1, max_length=10)
    count: int = Field(ge=1)
    reacted_by_me: bool


class SendMessageRequest(BaseModel):
    """Payload for creating a message in a channel."""

    model_config = ConfigDict(extra="forbid")

    channel_id: UUID
    text: str = Field(min_length=1, max_length=4096)
    mesh_origin: bool = False
    source_locale: str | None = Field(default=None, max_length=10)

    @field_validator("text", mode="before")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("source_locale", mode="before")
    @classmethod
    def _strip_locale(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class EditMessageRequest(BaseModel):
    """Payload for editing a message body."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=4096)

    @field_validator("text", mode="before")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ReactionRequest(BaseModel):
    """Payload for adding or removing one reaction."""

    model_config = ConfigDict(extra="forbid")

    emoji: str = Field(min_length=1, max_length=10)

    @field_validator("emoji", mode="before")
    @classmethod
    def _strip_emoji(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class MessageResponse(BaseModel):
    """Normalized, API-safe representation of a message."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    channel_id: UUID
    user_id: UUID
    workspace_id: UUID
    text: str
    text_translated: str | None = None
    source_locale: str | None = None
    sentiment_score: float | None = None
    mesh_origin: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    user: UserBrief
    reactions: list[ReactionSummary] = Field(default_factory=list)
    is_edited: bool = False

    @model_validator(mode="after")
    def _redact_deleted_messages(self) -> MessageResponse:
        if self.deleted_at is not None:
            self.text = "[deleted]"
        return self


class MessagesPageResponse(BaseModel):
    """Cursor-based page of messages for a channel."""

    model_config = ConfigDict(extra="forbid")

    messages: list[MessageResponse]
    next_cursor: str | None = None
    has_more: bool


# Backward-compatible aliases used by older route imports/tests.
MessageCreateRequest = SendMessageRequest
PaginatedMessagesResponse = MessagesPageResponse
