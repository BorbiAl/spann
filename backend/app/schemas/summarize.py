"""Schemas for the /channels/{channel_id}/summarize endpoint."""

from __future__ import annotations

from pydantic import BaseModel


class SummarizeResponse(BaseModel):
    """AI-generated thread summary."""

    bullets: list[str]
    decisions: list[str]
    action_items: list[str]
    message_count: int
    cached: bool
