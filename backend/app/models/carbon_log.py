"""Carbon log domain model."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CarbonLogModel(BaseModel):
    """Represents a commuting carbon entry for a user."""

    model_config = ConfigDict(extra="allow")

    id: str
    user_id: str
    workspace_id: str
    commute_mode: str
    distance_km: float
    grams_co2: float
    score_delta: int
    created_at: datetime | None = None
