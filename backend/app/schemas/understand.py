"""Schemas for the /understand unified AI endpoint."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class UserPreferences(BaseModel):
    """Reading and language preferences supplied by the client."""

    model_config = ConfigDict(extra="ignore")

    reading_level: str = Field(default="general", max_length=32)
    language: str = Field(default="en", max_length=16)  # BCP-47 tag for translation target


class MessageContext(BaseModel):
    """Optional surrounding context that shapes AI output."""

    model_config = ConfigDict(extra="ignore")

    thread: str | None = Field(default=None, max_length=500)
    channel_tone: str | None = Field(default=None, max_length=64)


class UnderstandRequest(BaseModel):
    """Input payload for POST /understand."""

    model_config = ConfigDict(extra="forbid")

    message_text: str = Field(min_length=1, max_length=4000)
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)
    context: MessageContext = Field(default_factory=MessageContext)


class IdiomEntry(BaseModel):
    """One detected non-literal phrase with its meaning and a localized equivalent."""

    phrase: str
    meaning: str
    localized_equivalent: str
    category: str  # "idiom" | "phrasal_verb" | "metaphor" | "slang" | "jargon"


class UnderstandResponse(BaseModel):
    """Full output from POST /understand."""

    simplified: str
    explanation: str
    idioms: list[IdiomEntry]
    tone_hint: str
    translated: str
