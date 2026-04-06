"""User and authentication request/response schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    """Credentials for email/password login."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class MagicLinkRequest(BaseModel):
    """Request payload for sending a magic link email."""

    email: EmailStr


class UserPreferencesPatchRequest(BaseModel):
    """Patch payload for user preferences and accessibility settings."""

    model_config = ConfigDict(extra="forbid")

    locale: str | None = Field(default=None, min_length=2, max_length=16)
    coaching_enabled: bool | None = None
    accessibility_settings: dict[str, Any] | None = None


class UserPreferencesResponse(BaseModel):
    """Response body for updated preferences."""

    locale: str
    coaching_enabled: bool
    accessibility_settings: dict[str, Any]
