"""Rate limiter behavior tests."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.middleware.rate_limit import SlidingWindowRateLimiter


@pytest.mark.asyncio
async def test_rate_limit_under_and_over_limit():
    limiter = SlidingWindowRateLimiter()

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
