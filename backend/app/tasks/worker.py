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
celery_app.conf.update(
    task_time_limit=30,
    task_soft_time_limit=25,
    task_acks_late=True,
)
celery_app.autodiscover_tasks(["app.tasks"])
