"""Celery application bootstrap and task discovery."""

from __future__ import annotations

from celery import Celery

from app.config import settings

celery_app = Celery(
    "spann",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.config_from_object("celeryconfig")
celery_app.autodiscover_tasks(["app.tasks"])
