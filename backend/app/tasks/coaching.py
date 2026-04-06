"""Celery task for coaching nudge generation and publishing."""

from __future__ import annotations

import asyncio
import json
import logging

from app.services.coaching import generate_coaching_nudge
from app.services.redis_client import redis_client
from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.coaching.generate_coaching_nudge_task",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def generate_coaching_nudge_task(
    self,
    *,
    message_id: str,
    channel_id: str,
    user_id: str,
    text: str,
    tone: str,
    locale: str,
) -> dict[str, str] | None:
    """Generate and publish coaching nudge for one message."""

    nudge = asyncio.run(generate_coaching_nudge(text=text, tone=tone, locale=locale))
    if nudge is None:
        return None

    payload = {
        "event": "coaching:nudge",
        "messageId": message_id,
        "channelId": channel_id,
        "userId": user_id,
        "nudge": nudge["nudge"],
        "severity": nudge["severity"],
    }
    asyncio.run(redis_client.publish(f"coaching:{channel_id}", json.dumps(payload)))
    logger.info("coaching_nudge_published", extra={"channel_id": channel_id, "message_id": message_id})
    return nudge


def trigger_coaching_task(*, message_id: str, channel_id: str, user_id: str, text: str, tone: str, locale: str) -> None:
    """Fire-and-forget helper used by API route handlers."""

    generate_coaching_nudge_task.delay(
        message_id=message_id,
        channel_id=channel_id,
        user_id=user_id,
        text=text,
        tone=tone,
        locale=locale,
    )
