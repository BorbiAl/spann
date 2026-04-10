"""Celery tasks for sentiment pulse updates."""

from __future__ import annotations
# mypy: disable-error-code=untyped-decorator

import asyncio
from datetime import UTC, datetime
import json
import logging
from typing import Any

from app.database import db
from app.services.groq_client import GroqAPIError, GroqTimeoutError
from app.services.sentiment import score_active_channels, score_channel
from app.services.redis_client import redis_client
from app.tasks.worker import celery_app, run_async

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.sentiment.score_active_channels",
    bind=True,
    autoretry_for=(GroqAPIError, GroqTimeoutError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    task_time_limit=30,
    task_soft_time_limit=25,
)
def score_active_channels_task(self: Any) -> dict[str, int]:
    """Periodically recompute sentiment for active channels."""

    try:
        result = run_async(score_active_channels())
    except (GroqAPIError, GroqTimeoutError) as exc:
        if self.request.retries >= 3:
            run_async(
                redis_client.push_list(
                    f"dead_letter:{self.name}",
                    json.dumps({"error": str(exc), "task": self.name}),
                )
            )
        raise
    logger.info("sentiment_channels_scored", extra=result)
    return result


@celery_app.task(
    name="app.tasks.sentiment.score_single_channel",
    bind=True,
    autoretry_for=(GroqAPIError, GroqTimeoutError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    task_time_limit=30,
    task_soft_time_limit=25,
)
def score_single_channel_task(self: Any, channel_id: str) -> dict[str, str]:
    """Run sentiment scoring for one channel on demand."""

    minute_bucket = datetime.now(UTC).replace(second=0, microsecond=0)
    if run_async(db.pulse_snapshot_exists_for_minute(channel_id, minute_bucket)):
        return {"channel_id": channel_id, "status": "skipped"}

    try:
        run_async(score_channel(channel_id))
        run_async(db.mark_pulse_snapshot_run(channel_id, minute_bucket))
    except (GroqAPIError, GroqTimeoutError) as exc:
        if self.request.retries >= 3:
            run_async(
                redis_client.push_list(
                    f"dead_letter:{self.name}",
                    json.dumps({"error": str(exc), "task": self.name, "channel_id": channel_id}),
                )
            )
        raise
    return {"channel_id": channel_id, "status": "ok"}
