"""Carbon logging schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CarbonLogRequest(BaseModel):
    """Payload for recording a commute event."""

    model_config = ConfigDict(extra="forbid")

    workspace_id: str = Field(min_length=1, max_length=128)
    commute_mode: str = Field(min_length=2, max_length=32)
    distance_km: float = Field(gt=0, le=300)


class CarbonLogResponse(BaseModel):
    """Response after logging a commute event."""

    id: str
    user_id: str
    workspace_id: str
    commute_mode: str
    distance_km: float
    grams_co2: float
    score_delta: int
    created_at: datetime | None = None


class CarbonLeaderboardEntry(BaseModel):
    """Carbon leaderboard row."""

    user_id: str
    display_name: str | None = None
    total_score: int
    total_grams_co2: float
