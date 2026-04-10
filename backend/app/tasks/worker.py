"""Celery application bootstrap and task discovery."""

from __future__ import annotations

import asyncio
import threading
from typing import Optional

from celery import Celery
from celery.signals import worker_process_init, worker_process_shutdown

from app.config import settings

# Initialized per-worker-process via worker_process_init signal.
# Module-level creation doesn't survive Celery's prefork() — threads are not
# copied to child processes, so any loop started here would not be running
# in the workers.
_celery_loop: Optional[asyncio.AbstractEventLoop] = None
_celery_thread: Optional[threading.Thread] = None


@worker_process_init.connect
def _init_worker_loop(**_kwargs: object) -> None:
    """Start a dedicated event loop in each forked worker process."""
    global _celery_loop, _celery_thread
    _celery_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_celery_loop)
    _celery_thread = threading.Thread(target=_celery_loop.run_forever, daemon=True)
    _celery_thread.start()


@worker_process_shutdown.connect
def _shutdown_worker_loop(**_kwargs: object) -> None:
    """Cleanly stop the event loop when the worker process exits."""
    if _celery_loop and _celery_loop.is_running():
        _celery_loop.call_soon_threadsafe(_celery_loop.stop)


def run_async(coro):
    """Run an async coroutine on the background worker loop synchronously."""
    if _celery_loop is None or not _celery_loop.is_running():
        # Fallback for eager task execution in tests or the main process.
        return asyncio.run(coro)
    return asyncio.run_coroutine_threadsafe(coro, _celery_loop).result()

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
