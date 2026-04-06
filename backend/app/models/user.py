"""User domain model."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr


class UserModel(BaseModel):
    """Represents a Spann user profile."""

    model_config = ConfigDict(extra="allow")

    id: str
    email: EmailStr
    display_name: str | None = None
    workspace_id: str | None = None
    locale: str = "en-US"
    coaching_enabled: bool = True
    accessibility_settings: dict[str, Any] = {}
    created_at: datetime | None = None
