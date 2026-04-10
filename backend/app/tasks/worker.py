"""Celery application bootstrap and task discovery."""

from __future__ import annotations

from celery import Celery

from app.config import settings

# Provide a global long-lived event loop for all async tasks in Celery worker
import threading
import asyncio

celery_loop = asyncio.new_event_loop()

def _run_loop():
    asyncio.set_event_loop(celery_loop)
    celery_loop.run_forever()

celery_thread = threading.Thread(target=_run_loop, daemon=True)
celery_thread.start()

def run_async(coro):
    """Run an async coroutine on the background worker loop synchronously."""
    return asyncio.run_coroutine_threadsafe(coro, celery_loop).result()

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
