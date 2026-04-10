"""User and authentication request/response schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    """Credentials for email/password login."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class MagicLinkRequest(BaseModel):
    """Request payload for sending a magic link email."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class UserProfilePatchRequest(BaseModel):
    """Patch payload for mutable user profile fields."""

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    bio: str | None = Field(default=None, max_length=500)
    timezone: str | None = Field(default=None, max_length=64)


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
