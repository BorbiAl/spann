"""Celery coaching task with Redis cache and dead-letter fallback."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging

from app.database import db
from app.services.coaching import generate_coaching_nudge
from app.services.groq_client import GroqAPIError, GroqTimeoutError
from app.services.redis_client import redis_client
from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


async def _resolve_channel_id(message_id: str) -> str | None:
    message = await db.get_message_by_id(message_id)
    if message is None:
        return None
    channel_id = message.get("channel_id")
    return str(channel_id) if channel_id else None


async def _publish_nudge(channel_id: str, message_id: str, nudge: str, severity: str) -> None:
    payload = {
        "event": "coaching:nudge",
        "message_id": message_id,
        "nudge": nudge,
        "severity": severity,
    }
    await redis_client.publish(f"messages:{channel_id}", json.dumps(payload))


@celery_app.task(
    name="app.tasks.coaching.run_coaching",
    bind=True,
    max_retries=3,
    autoretry_for=(GroqAPIError, GroqTimeoutError),
    default_retry_delay=2,
    task_time_limit=30,
    task_soft_time_limit=25,
)
def run_coaching(
    self,
    message_id: str,
    text: str,
    channel_tone: str | None = None,
    user_locale: str | None = None,
    **legacy_kwargs,
):
    """Generate and publish a coaching nudge after message delivery."""

    channel_tone = channel_tone or str(legacy_kwargs.get("tone") or "neutral")
    user_locale = user_locale or str(legacy_kwargs.get("locale") or "en-US")
    cache_key = f"coaching:{hashlib.sha256(text.encode()).hexdigest()}"
    channel_id = str(legacy_kwargs.get("channel_id") or "") or asyncio.run(_resolve_channel_id(message_id))
    if not channel_id:
        return None

    cached_payload = asyncio.run(redis_client.get_json(cache_key))
    if cached_payload:
        parsed = json.loads(cached_payload)
        asyncio.run(_publish_nudge(channel_id, message_id, parsed["nudge"], parsed["severity"]))
        return parsed

    try:
        nudge_payload = asyncio.run(
            generate_coaching_nudge(
                text=text,
                tone=channel_tone,
                locale=user_locale,
            )
        )
    except (GroqAPIError, GroqTimeoutError) as exc:
        if self.request.retries >= self.max_retries:
            asyncio.run(
                redis_client.push_list(
                    "dead_letter:coaching",
                    json.dumps(
                        {
                            "message_id": message_id,
                            "text": text,
                            "channel_tone": channel_tone,
                            "user_locale": user_locale,
                            "error": str(exc),
                        }
                    ),
                )
            )
        raise

    if nudge_payload is None:
        return None

    asyncio.run(redis_client.set_json(cache_key, json.dumps(nudge_payload), ex_seconds=300))
    asyncio.run(
        _publish_nudge(
            channel_id,
            message_id,
            nudge_payload["nudge"],
            nudge_payload["severity"],
        )
    )

    logger.info("coaching_nudge_published", extra={"message_id": message_id, "channel_id": channel_id})
    return nudge_payload


# Backward-compatible task alias used by existing tests and call sites.
generate_coaching_nudge_task = run_coaching


def trigger_coaching_task(*, message_id: str, text: str, channel_tone: str, user_locale: str) -> None:
    """Fire-and-forget helper for the message creation path."""

    run_coaching.delay(
        message_id=message_id,
        text=text,
        channel_tone=channel_tone,
        user_locale=user_locale,
    )
