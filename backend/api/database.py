"""
Supabase async client — singleton lifecycle managed by FastAPI's lifespan.

Usage in endpoints:
    async def my_endpoint(db: SupabaseClient = Depends(get_db)):
        result = await db.table("workspaces").select("*").execute()
"""

from __future__ import annotations

import os
from typing import AsyncGenerator

import structlog
from supabase import AsyncClient, acreate_client

logger = structlog.get_logger(__name__)

# Module-level singleton — initialised in lifespan, never None at request time.
_client: AsyncClient | None = None


async def init_db() -> None:
    """Create the Supabase async client. Called once during app startup."""
    global _client  # noqa: PLW0603

    url = os.environ.get("SUPABASE_URL", "")
    # Prefer service role key for server-side writes; fall back to anon key.
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set."
        )

    _client = await acreate_client(url, key)
    logger.info("supabase_client_ready", url=url[:40] + "…")


async def close_db() -> None:
    """Tear down the client gracefully. Called during app shutdown."""
    global _client  # noqa: PLW0603
    if _client is not None:
        # supabase-py v2 exposes the underlying httpx session via .postgrest._session
        try:
            session = getattr(_client.postgrest, "_session", None)
            if session is not None:
                await session.aclose()
        except Exception as exc:  # noqa: BLE001
            logger.warning("supabase_close_error", error=str(exc))
        _client = None
        logger.info("supabase_client_closed")


async def get_db() -> AsyncGenerator[AsyncClient, None]:
    """
    FastAPI dependency — yields the shared Supabase async client.

    Raises RuntimeError if called before `init_db()` has completed
    (i.e. before the app lifespan has started).
    """
    if _client is None:
        raise RuntimeError("Supabase client not initialised. Is the app lifespan running?")
    yield _client


# Convenience type alias for dependency annotations
SupabaseClient = AsyncClient
