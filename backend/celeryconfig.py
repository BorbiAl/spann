"""Celery configuration for background workers and beat schedules."""

from __future__ import annotations

import os
from datetime import timedelta

broker_url = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://valkey:6379/0"))
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://valkey:6379/1")
accept_content = ["json"]
task_serializer = "json"
result_serializer = "json"
timezone = "UTC"
enable_utc = True

beat_schedule = {
    "sentiment-score-channels": {
        "task": "app.tasks.sentiment.score_active_channels",
        "schedule": 60.0,
    },
    "recalculate-carbon-leaderboard": {
        "task": "app.tasks.carbon.recalculate_carbon_leaderboard",
        "schedule": timedelta(minutes=5),
    },
}
