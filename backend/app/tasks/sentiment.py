"""Celery tasks for sentiment pulse updates."""

from __future__ import annotations

import asyncio
import logging

from app.services.sentiment import score_active_channels, score_channel
from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.sentiment.score_active_channels",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def score_active_channels_task() -> dict[str, int]:
    """Periodically recompute sentiment for active channels."""

    result = asyncio.run(score_active_channels())
    logger.info("sentiment_channels_scored", extra=result)
    return result


@celery_app.task(
    name="app.tasks.sentiment.score_single_channel",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def score_single_channel_task(channel_id: str) -> dict[str, str]:
    """Run sentiment scoring for one channel on demand."""

    asyncio.run(score_channel(channel_id))
    return {"channel_id": channel_id, "status": "ok"}
