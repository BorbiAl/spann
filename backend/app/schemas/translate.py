"""Translation and coaching schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TranslateRequest(BaseModel):
    """Payload for literal plus cultural translation."""

    model_config = ConfigDict(extra="forbid")

    phrase: str = Field(min_length=1, max_length=2000)
    source_locale: str = Field(min_length=2, max_length=16)
    target_locale: str = Field(min_length=2, max_length=16)
    source_culture: str = Field(min_length=2, max_length=64)
    target_culture: str = Field(min_length=2, max_length=64)
    workplace_tone: str = Field(min_length=2, max_length=64)


class TranslateResponse(BaseModel):
    """Translation output shape from Groq."""

    literal: str
    cultural: str
    explanation: str
    tags: list[str] = Field(default_factory=list)
    sentiment_label: str = "neutral"
    sentiment_score: int = 50


class CoachingNudge(BaseModel):
    """Coaching nudge response returned by AI service."""

    nudge: str
    severity: str
