"""In-process async sliding-window rate limiting helpers."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import HTTPException

RATE_WINDOW_SECONDS = 60


@dataclass(slots=True)
class RateLimitBucket:
    """Holds request timestamps for one identity and bucket."""

    timestamps: deque[float]


class SlidingWindowRateLimiter:
    """Simple per-key sliding-window limiter safe for asyncio concurrency."""

    def __init__(self) -> None:
        self._storage: dict[str, RateLimitBucket] = defaultdict(lambda: RateLimitBucket(timestamps=deque()))
        self._lock = asyncio.Lock()

    async def enforce(self, *, identity: str, bucket: str, limit: int) -> None:
        """Raise HTTP 429 if the identity has exhausted the bucket window."""

        now = time.monotonic()
        key = f"{bucket}:{identity}"

        async with self._lock:
            rate_bucket = self._storage[key]
            timestamps = rate_bucket.timestamps
            window_start = now - RATE_WINDOW_SECONDS

            while timestamps and timestamps[0] <= window_start:
                timestamps.popleft()

            if len(timestamps) >= limit:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded for bucket '{bucket}'. Try again in a minute.",
                    },
                )

            timestamps.append(now)


rate_limiter = SlidingWindowRateLimiter()
