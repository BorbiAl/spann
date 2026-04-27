"""Request/response schemas for the /understand endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    reading_level: str = "standard"
    language: str = "en"


class UnderstandRequest(BaseModel):
    message_text: str = Field(..., min_length=1, max_length=4000)
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)
