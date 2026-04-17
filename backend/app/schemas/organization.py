"""Organization onboarding schemas."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganizationCreateRequest(BaseModel):
    """Payload for creating a new organization."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=120)


class OrganizationInviteRequest(BaseModel):
    """Payload for inviting a user email to an organization."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    note: str | None = Field(default=None, max_length=500)


class OrganizationJoinRequestCreate(BaseModel):
    """Payload for requesting organization membership."""

    model_config = ConfigDict(extra="forbid")

    workspace_id: UUID
    message: str | None = Field(default=None, max_length=500)


class JoinRequestDecisionRequest(BaseModel):
    """Payload for owner/admin approval or rejection of join requests."""

    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "reject"]


class InvitationDecisionRequest(BaseModel):
    """Payload for accepting or rejecting an invitation."""

    model_config = ConfigDict(extra="forbid")

    decision: Literal["accept", "reject"]
