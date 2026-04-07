"""Redis-backed distributed sliding-window rate limiting helpers."""

from __future__ import annotations

import asyncio
import logging
import math
import time
from dataclasses import dataclass
from typing import Any, cast

from fastapi import HTTPException, Request
from redis.asyncio import Redis

from app.config import settings
from app.metrics import rate_limit_hits_total

logger = logging.getLogger(__name__)

RATE_LIMIT_LUA_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clear_before = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clear_before)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
    redis.call('PEXPIRE', key, window)
  return {1, limit - count - 1}
else
  return {0, 0}
end
"""

RATE_WINDOW_SECONDS = 60


@dataclass(slots=True)
class RateLimitBucket:
    """Evaluation result returned by the distributed limiter."""

    allowed: bool
    limit: int
    remaining: int
    reset_epoch_seconds: int

    @property
    def headers(self) -> dict[str, str]:
        """Build standard rate limit headers for API responses."""

        return {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(max(0, self.remaining)),
            "X-RateLimit-Reset": str(self.reset_epoch_seconds),
        }


class SlidingWindowRateLimiter:
    """Redis-backed rate limiter safe for distributed deployments."""

    def __init__(self) -> None:
        self._redis: Redis | None = None
        self._lock = asyncio.Lock()
        self._script_sha: str | None = None
        self._fallback_lock = asyncio.Lock()
        self._fallback_windows: dict[str, list[int]] = {}

    async def _enforce_fallback(
        self,
        *,
        key: str,
        bucket: str,
        limit: int,
        now_ms: int,
        now_epoch: int,
        reset_epoch: int,
        window_seconds: int,
        request: Request | None,
    ) -> RateLimitBucket:
        """Apply local in-memory rate limiting when Redis is unavailable."""

        window_ms = window_seconds * 1000
        cutoff_ms = now_ms - window_ms

        async with self._fallback_lock:
            existing = self._fallback_windows.get(key, [])
            kept = [value for value in existing if value > cutoff_ms]
            allowed = len(kept) < limit
            if allowed:
                kept.append(now_ms)
            self._fallback_windows[key] = kept
            remaining = max(0, limit - len(kept))

        bucket_result = RateLimitBucket(
            allowed=allowed,
            limit=limit,
            remaining=remaining,
            reset_epoch_seconds=reset_epoch,
        )
        if request is not None:
            request.state.rate_limit_headers = bucket_result.headers

        if not allowed:
            rate_limit_hits_total.labels(bucket=bucket).inc()
            retry_after = max(1, int(math.ceil(bucket_result.reset_epoch_seconds - now_epoch)))
            headers = dict(bucket_result.headers)
            headers["Retry-After"] = str(retry_after)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMITED",
                    "message": f"Rate limit exceeded for bucket '{bucket}'.",
                },
                headers=headers,
            )

        return bucket_result

    async def _get_redis(self) -> Redis:
        """Return shared Redis client using bounded pool configuration."""

        if self._redis is not None:
            return self._redis

        async with self._lock:
            if self._redis is None:
                self._redis = Redis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                    max_connections=20,
                    socket_timeout=0.5,
                    socket_connect_timeout=0.5,
                )
        return self._redis

    async def _load_script_if_needed(self, redis: Redis) -> str:
        """Load and cache script SHA used by evalsha."""

        if self._script_sha is not None:
            return self._script_sha

        async with self._lock:
            if self._script_sha is None:
                self._script_sha = await redis.script_load(RATE_LIMIT_LUA_SCRIPT)
        return self._script_sha

    async def enforce(
        self,
        *,
        identity: str,
        bucket: str,
        limit: int,
        request: Request | None = None,
        window_seconds: int = RATE_WINDOW_SECONDS,
    ) -> RateLimitBucket:
        """Enforce per-bucket limits. If Redis fails, allow request and log."""

        now_epoch = int(time.time())
        now_ms = int(time.time() * 1000)
        reset_epoch = now_epoch + window_seconds

        safe_bucket = bucket.strip().lower() or "public"
        safe_identity = identity.strip() or "unknown"
        key = f"rate:{safe_bucket}:{safe_identity}"

        try:
            redis = await self._get_redis()
            script_sha = await self._load_script_if_needed(redis)
            result = await cast(Any, redis.evalsha(script_sha, 1, key, now_ms, window_seconds * 1000, limit))
            allowed = int(result[0]) == 1
            remaining = int(result[1]) if len(result) > 1 else 0

            bucket_result = RateLimitBucket(
                allowed=allowed,
                limit=limit,
                remaining=remaining,
                reset_epoch_seconds=reset_epoch,
            )
            if request is not None:
                request.state.rate_limit_headers = bucket_result.headers

            if not allowed:
                rate_limit_hits_total.labels(bucket=safe_bucket).inc()
                retry_after = max(1, int(math.ceil(bucket_result.reset_epoch_seconds - now_epoch)))
                headers = dict(bucket_result.headers)
                headers["Retry-After"] = str(retry_after)
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded for bucket '{safe_bucket}'.",
                    },
                    headers=headers,
                )

            return bucket_result
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            request_id = getattr(request.state, "request_id", None) if request is not None else None
            logger.error(
                "rate_limit_fail_open",
                extra={"bucket": safe_bucket, "identity": safe_identity, "request_id": request_id, "error": str(exc)},
            )
            return await self._enforce_fallback(
                key=key,
                bucket=safe_bucket,
                limit=limit,
                now_ms=now_ms,
                now_epoch=now_epoch,
                reset_epoch=reset_epoch,
                window_seconds=window_seconds,
                request=request,
            )


async def auth_rate_limit_dependency(request: Request) -> None:
    """Apply auth brute-force protection: 10 requests/minute by IP."""

    source_ip = _extract_source_ip(request)
    await rate_limiter.enforce(
        identity=source_ip,
        bucket="auth",
        limit=settings.auth_rate_limit_per_minute,
        request=request,
    )


async def messages_rate_limit_dependency(request: Request) -> None:
    """Apply message send/read protection: 60 requests/minute by user."""

    user_id = str(getattr(request.state, "user_id", "unknown"))
    await rate_limiter.enforce(
        identity=user_id,
        bucket="messages",
        limit=settings.messages_rate_limit_per_minute,
        request=request,
    )


async def translate_rate_limit_dependency(request: Request) -> None:
    """Apply translation protection: 100 requests/minute by user."""

    user_id = str(getattr(request.state, "user_id", "unknown"))
    await rate_limiter.enforce(
        identity=user_id,
        bucket="translate",
        limit=settings.translate_rate_limit_per_minute,
        request=request,
    )


async def public_rate_limit_dependency(request: Request) -> None:
    """Apply default public route protection: 200 requests/minute by IP."""

    source_ip = _extract_source_ip(request)
    await rate_limiter.enforce(identity=source_ip, bucket="public", limit=200, request=request)


def _extract_source_ip(request: Request) -> str:
    """Resolve client IP, honoring X-Forwarded-For when present."""

    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        first_hop = forwarded_for.split(",", 1)[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"


rate_limiter = SlidingWindowRateLimiter()
