"""Celery tasks for carbon leaderboard maintenance."""

from __future__ import annotations
# mypy: disable-error-code=untyped-decorator

import asyncio
import json
import logging

from app.database import db
from app.services.redis_client import redis_client
from app.tasks.worker import celery_app, run_async

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.carbon.recalculate_carbon_leaderboard",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def recalculate_carbon_leaderboard(workspace_id: str | None = None) -> dict[str, int]:
    """Recalculate carbon leaderboard aggregates and cache via Redis."""

    refreshed = run_async(db.recalculate_carbon_leaderboard(workspace_id))

    for ws_id, entries in refreshed.items():
        run_async(redis_client.set_json(f"carbon:leaderboard:{ws_id}", json.dumps(entries), ex_seconds=300))

    total_entries = sum(len(rows) for rows in refreshed.values())
    logger.info("carbon_leaderboard_recalculated", extra={"workspaces": len(refreshed), "entries": total_entries})
    return {"workspaces": len(refreshed), "entries": total_entries}
