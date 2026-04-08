"""Rate limiter behavior tests."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.middleware.rate_limit import SlidingWindowRateLimiter


@pytest.mark.asyncio
async def test_rate_limit_under_and_over_limit():
    limiter = SlidingWindowRateLimiter()

    async def fail_get_redis():
        raise RuntimeError("redis unavailable for deterministic fallback test")

    limiter._get_redis = fail_get_redis  # type: ignore[method-assign]

    await limiter.enforce(identity="user-a", bucket="messages", limit=2)
    await limiter.enforce(identity="user-a", bucket="messages", limit=2)

    with pytest.raises(HTTPException) as excinfo:
        await limiter.enforce(identity="user-a", bucket="messages", limit=2)

    assert excinfo.value.status_code == 429


@pytest.mark.asyncio
async def test_rate_limit_isolated_per_user():
    limiter = SlidingWindowRateLimiter()

    await limiter.enforce(identity="user-a", bucket="messages", limit=1)
    await limiter.enforce(identity="user-b", bucket="messages", limit=2)

    with pytest.raises(HTTPException):
        await limiter.enforce(identity="user-a", bucket="messages", limit=1)

    # user-b should remain unaffected by user-a exhaustion
    await limiter.enforce(identity="user-b", bucket="messages", limit=2)


@pytest.mark.asyncio
async def test_rate_limit_fallback_over_limit_returns_retry_after_header():
    limiter = SlidingWindowRateLimiter()
    now_ms = 1_700_000_000_000
    now_epoch = now_ms // 1000
    window_seconds = 60
    key = "rate:messages:user-x"

    # Prime the in-memory fallback window so the next request exceeds limit=1.
    limiter._fallback_windows[key] = [now_ms - 500]  # type: ignore[attr-defined]

    with pytest.raises(HTTPException) as excinfo:
        await limiter._enforce_fallback(
            key=key,
            bucket="messages",
            limit=1,
            now_ms=now_ms,
            now_epoch=now_epoch,
            reset_epoch=now_epoch + window_seconds,
            window_seconds=window_seconds,
            request=None,
        )

    assert excinfo.value.status_code == 429
    assert excinfo.value.headers is not None
    assert excinfo.value.headers.get("Retry-After") == str(window_seconds)
