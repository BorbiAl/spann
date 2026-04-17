"""
Pydantic v2 request/response models for the Spann accessibility API.

All models use strict validation.  Request models are validated on ingress;
response models serve as the authoritative serialization contract.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# =============================================================================
# Enums
# =============================================================================


class PlatformEnum(str, Enum):
    SLACK = "slack"
    TEAMS = "teams"
    DISCORD = "discord"


class PlanEnum(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class ToneIndicatorEnum(str, Enum):
    URGENT = "URGENT"
    CASUAL = "CASUAL"
    FORMAL = "FORMAL"
    AGGRESSIVE = "AGGRESSIVE"
    SUPPORTIVE = "SUPPORTIVE"
    NEUTRAL = "NEUTRAL"


class DisabilityTypeEnum(str, Enum):
    VISUAL = "VISUAL"
    DEAF = "DEAF"
    MOTOR = "MOTOR"
    COGNITIVE = "COGNITIVE"
    DYSLEXIA = "DYSLEXIA"
    ANXIETY = "ANXIETY"


class SubscriptionStatusEnum(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    TRIALING = "trialing"
    UNPAID = "unpaid"


# =============================================================================
# Shared validators
# =============================================================================

_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9_\-\.]{1,128}$")


def _validate_platform_id(v: str) -> str:
    """Platform-native IDs are alphanumeric with a few safe punctuation chars."""
    if not _SAFE_ID_RE.match(v):
        raise ValueError("platform_id must be 1–128 alphanumeric/underscore/hyphen characters")
    return v


# =============================================================================
# Request models
# =============================================================================


class WorkspaceRegisterIn(BaseModel):
    """Payload sent by a platform bot on first install."""

    platform: PlatformEnum
    platform_workspace_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=256)
    billing_email: EmailStr | None = None

    @field_validator("platform_workspace_id")
    @classmethod
    def validate_platform_workspace_id(cls, v: str) -> str:
        return _validate_platform_id(v)


class ProfileIn(BaseModel):
    """Create or update an accessibility profile."""

    platform: PlatformEnum
    workspace_id: str = Field(..., min_length=1, max_length=64)
    display_name: str | None = Field(default=None, max_length=256)
    email: EmailStr | None = None
    disability_types: list[DisabilityTypeEnum] = Field(default_factory=list)
    # Free-form JSONB settings blob, validated downstream by the TypeScript types
    settings: dict[str, Any] = Field(default_factory=dict)

    @field_validator("disability_types")
    @classmethod
    def deduplicate_types(cls, v: list[DisabilityTypeEnum]) -> list[DisabilityTypeEnum]:
        return list(dict.fromkeys(v))  # preserve order, remove duplicates


class MessageContextIn(BaseModel):
    """Incoming message context submitted by a platform bot."""

    platform_id: PlatformEnum
    channel_id: str = Field(..., min_length=1, max_length=128)
    author_id: str = Field(..., min_length=1, max_length=128)
    raw_text: str = Field(..., min_length=1, max_length=10_000)
    workspace_id: str = Field(..., min_length=1, max_length=64)
    thread_id: str | None = Field(default=None, max_length=128)
    timestamp: datetime | None = None

    @field_validator("author_id", "channel_id")
    @classmethod
    def validate_ids(cls, v: str) -> str:
        return _validate_platform_id(v)

    @model_validator(mode="after")
    def strip_text(self) -> "MessageContextIn":
        self.raw_text = self.raw_text.strip()
        return self


# =============================================================================
# Response models
# =============================================================================


class WorkspaceOut(BaseModel):
    """Workspace row returned to the bot after registration."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: PlatformEnum
    platform_workspace_id: str
    name: str
    plan: PlanEnum
    created_at: datetime


class SubscriptionOut(BaseModel):
    """Subscription state — returned alongside workspace on register."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    plan: PlanEnum
    seats: int
    status: SubscriptionStatusEnum
    current_period_end: datetime | None = None


class WorkspaceRegisterOut(BaseModel):
    """Full response for POST /api/workspaces/register."""

    workspace: WorkspaceOut
    subscription: SubscriptionOut


class ProfileOut(BaseModel):
    """Accessibility profile — returned to the bot to drive processing."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    disability_types: list[str]
    settings: dict[str, Any]
    updated_at: datetime


class ProcessedMessageOut(BaseModel):
    """Result of running a message through the Spann AI pipeline."""

    message_id: str
    original_text: str
    simplified: str
    tone_indicator: ToneIndicatorEnum
    # Flesch-Kincaid grade level of the simplified text
    reading_level: int = Field(..., ge=1, le=12)
    processing_ms: int = Field(..., description="End-to-end wall time in milliseconds")


class WorkspaceStatsOut(BaseModel):
    """Aggregated usage stats for the admin dashboard."""

    workspace_id: str
    plan: PlanEnum
    seats: int
    total_messages_processed: int
    messages_this_month: int
    active_users_this_month: int
    avg_processing_ms: float | None = None


class ErrorOut(BaseModel):
    """Standard error envelope."""

    code: str
    message: str
    details: Any = None
