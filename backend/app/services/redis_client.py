"""Async Redis publisher for cross-service event delivery."""

from __future__ import annotations

import asyncio
import logging

from redis.asyncio import Redis

from app.config import settings
from app.metrics import redis_connected

logger = logging.getLogger(__name__)


class RedisClient:
    """Lazily initialized Redis helper with async-safe connection setup."""

    def __init__(self) -> None:
        self._redis: Redis | None = None
        self._lock = asyncio.Lock()

    async def _get(self) -> Redis:
        """Return a shared Redis connection instance."""

        if self._redis is not None:
            return self._redis

        async with self._lock:
            if self._redis is None:
                self._redis = Redis.from_url(settings.redis_url, decode_responses=True)
                logger.info("redis_client_initialized")
                redis_connected.set(1)

        return self._redis

    async def publish(self, channel: str, payload: str) -> int:
        """Publish a payload to a Redis pub/sub channel."""

        redis = await self._get()
        subscribers = await redis.publish(channel, payload)
        logger.info("redis_publish", extra={"channel": channel, "subscribers": subscribers})
        return subscribers

    async def get_client(self) -> Redis:
        """Expose initialized Redis client for read-only metric pollers."""

        return await self._get()

    async def set_json(self, key: str, payload: str, ex_seconds: int | None = None) -> None:
        """Set JSON value with optional expiration."""

        redis = await self._get()
        await redis.set(key, payload, ex=ex_seconds)

    async def get_json(self, key: str) -> str | None:
        """Read JSON value by key."""

        redis = await self._get()
        return await redis.get(key)

    async def push_list(self, key: str, payload: str) -> int:
        """Push one JSON payload into Redis list (dead-letter queue)."""

        redis = await self._get()
        return await redis.lpush(key, payload)

    async def close(self) -> None:
        """Close the Redis connection cleanly."""

        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None
            redis_connected.set(0)


redis_client = RedisClient()
