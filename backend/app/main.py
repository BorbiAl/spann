"""FastAPI application entrypoint for Spann backend services."""

from __future__ import annotations

import asyncio
import logging
from logging.config import dictConfig
from time import monotonic

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger

from app.config import settings
from app.database import db
from app.metrics import MetricsMiddleware, metrics_response, refresh_infra_metrics
from app.middleware.auth import AuthMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.routers import auth, carbon, channels, mesh, messages, pulse, translate, users
from app.schemas.common import error_response, success_response
from app.services.groq_client import groq_client
from app.services.redis_client import redis_client
from app.services.redis_publisher import RedisPublisher


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """JSON formatter that always includes structured defaults."""

    def add_fields(self, log_record, record, message_dict):  # type: ignore[override]
        """Inject default keys for cleaner ingestion in log pipelines."""

        super().add_fields(log_record, record, message_dict)
        log_record.setdefault("level", record.levelname)
        log_record.setdefault("logger", record.name)


def configure_logging() -> None:
    """Configure application-wide structured JSON logging."""

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "()": CustomJsonFormatter,
                    "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                }
            },
            "root": {
                "handlers": ["console"],
                "level": settings.log_level.upper(),
            },
        }
    )


configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version="1.0.0")
APP_START_MONOTONIC = monotonic()
METRICS_TASK: asyncio.Task | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", settings.request_id_header],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(AuthMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Transform FastAPI HTTP exceptions into standard envelopes."""

    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code", "HTTP_ERROR"))
        message = str(detail.get("message", "Request failed."))
        details = detail.get("details")
    else:
        code = "HTTP_ERROR"
        message = str(detail)
        details = None

    return error_response(
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details,
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    """Map validation exceptions to 422 envelope responses."""

    return error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="One or more request fields are invalid.",
        details={"issues": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch unexpected errors and return safe, descriptive responses."""

    request_id = getattr(request.state, "request_id", None)
    logger.exception("unhandled_exception", extra={"request_id": request_id, "error": str(exc)})
    return error_response(
        status_code=500,
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred. Please retry or contact support.",
    )


@app.on_event("startup")
async def on_startup() -> None:
    """Initialize external clients and verify critical dependencies."""

    global METRICS_TASK

    healthy = await db.healthcheck()
    if not healthy:
        logger.warning("startup_supabase_unhealthy")

    if not hasattr(app.state, "redis_publisher"):
        app.state.redis_publisher = RedisPublisher(settings.redis_url)

    async def _metrics_loop() -> None:
        while True:
            try:
                redis = await redis_client.get_client()
                await refresh_infra_metrics(redis)
            except Exception as exc:  # noqa: BLE001
                logger.warning("metrics_refresh_failed", extra={"error": str(exc)})
            await asyncio.sleep(10)

    METRICS_TASK = asyncio.create_task(_metrics_loop(), name="metrics-refresh-loop")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Close outgoing network clients cleanly."""

    global METRICS_TASK

    if METRICS_TASK is not None:
        METRICS_TASK.cancel()
        try:
            await METRICS_TASK
        except asyncio.CancelledError:
            pass
        METRICS_TASK = None

    await groq_client.close()
    await redis_client.close()

    publisher = getattr(app.state, "redis_publisher", None)
    if publisher is not None:
        await publisher.close()


@app.get("/health")
async def health() -> object:
    """Container health endpoint."""

    return success_response(
        {
            "status": "ok",
            "version": app.version,
            "uptime": int(monotonic() - APP_START_MONOTONIC),
        }
    )


@app.get("/metrics")
async def metrics() -> object:
    """Prometheus scraping endpoint for operational telemetry."""

    return metrics_response()


app.include_router(auth.router)
app.include_router(channels.router)
app.include_router(messages.router)
app.include_router(translate.router)
app.include_router(carbon.router)
app.include_router(pulse.router)
app.include_router(users.router)
app.include_router(mesh.router)
