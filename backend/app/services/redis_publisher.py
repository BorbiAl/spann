"""Redis pub/sub publisher shared across API routes and workers."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from fastapi import Request
from redis.asyncio import ConnectionPool, Redis

logger = logging.getLogger(__name__)


class RedisPublisher:
    """Thin async Redis pub/sub helper with fail-open behavior."""

    def __init__(self, redis_url: str):
        self._pool = ConnectionPool.from_url(
            redis_url,
            decode_responses=True,
            max_connections=40,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        self._client = Redis(connection_pool=self._pool)

    @staticmethod
    def _json_default(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")

    async def publish(self, channel: str, payload: dict) -> None:
        """Publish one event payload and never fail request flow on Redis errors."""

        request_id = str(payload.get("_request_id") or "unknown")
        safe_payload = {key: value for key, value in payload.items() if key != "_request_id"}

        try:
            body = json.dumps(safe_payload, default=self._json_default)
            await self._client.publish(channel, body)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "redis_publish_failed",
                extra={
                    "request_id": request_id,
                    "channel": channel,
                    "error": str(exc),
                },
            )

    async def close(self) -> None:
        """Close Redis connections."""

        await self._client.aclose()
        await self._pool.aclose()


async def get_redis_publisher(request: Request) -> RedisPublisher:
    """Return a singleton publisher from FastAPI app state."""

    publisher = getattr(request.app.state, "redis_publisher", None)
    if publisher is None:
        from app.config import settings

        publisher = RedisPublisher(settings.redis_url)
        request.app.state.redis_publisher = publisher
    return publisher
