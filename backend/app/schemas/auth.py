"""Authentication request and response schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    """Payload for creating a new local account."""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=120)
    device_hint: str | None = Field(default=None, max_length=64)


class LoginRequest(BaseModel):
    """Credentials for email/password login."""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    device_hint: str | None = Field(default=None, max_length=64)


class LoginResponse(BaseModel):
    """Token pair returned after successful login or refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Refresh token exchange payload."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(..., min_length=128, max_length=128)


class LogoutRequest(BaseModel):
    """Logout payload containing refresh token to revoke."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(..., min_length=128, max_length=128)
