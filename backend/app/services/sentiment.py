"""Sentiment scoring workflows for channel pulse updates."""

from __future__ import annotations

import json

from app.database import db
from app.services.groq_client import groq_client
from app.services.redis_client import redis_client


async def get_last_n_messages(channel_id: str, n: int) -> list[dict[str, str]]:
    """Return the latest N messages for sentiment analysis."""

    return await db.get_last_n_messages(channel_id, n=n)


async def save_pulse_snapshot(channel_id: str, score: float, label: str) -> None:
    """Persist pulse snapshots for historical analytics."""

    await db.save_pulse_snapshot(channel_id, score, label)


async def score_channel(channel_id: str) -> None:
    """Score one channel using the latest messages and publish pulse updates."""

    messages = await get_last_n_messages(channel_id, n=20)
    scores = []
    for msg in messages:
        response = await groq_client.chat([
            {"role": "system", "content": "Score this message sentiment from -1.0 (very negative) to 1.0 (very positive). Return ONLY a float."},
            {"role": "user", "content": msg["text"]}
        ], task_type="sentiment")
        scores.append(float(response.strip()))
    avg = sum(scores) / len(scores) if scores else 0.0
    label = "positive" if avg > 0.3 else "stressed" if avg < -0.3 else "neutral"
    await redis_client.publish(f"pulse:{channel_id}", json.dumps({
        "channelId": channel_id,
        "score": avg,
        "label": label
    }))
    await save_pulse_snapshot(channel_id, avg, label)


async def score_active_channels() -> dict[str, int]:
    """Score all recently active channels and return processing counts."""

    channel_ids = await db.list_active_channel_ids(minutes=30)
    for channel_id in channel_ids:
        await score_channel(channel_id)
    return {"channels_scored": len(channel_ids)}
