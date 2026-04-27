"""FastAPI application entrypoint for Spann backend services."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator, Awaitable, Callable
from logging.config import dictConfig
from time import monotonic
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pythonjsonlogger.json import JsonFormatter
from starlette.responses import Response

from app.config import settings
from app.database import db
from app.metrics import MetricsMiddleware, metrics_response, refresh_infra_metrics
from app.middleware.auth import AuthMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.routers import auth, calls, carbon, channels, mesh, messages, organizations, pulse, runtime_config, translate, understand, users
from app.schemas.common import error_response
from app.services.groq_client import groq_client
from app.services.redis_client import redis_client
from app.services.redis_publisher import RedisPublisher


class CustomJsonFormatter(JsonFormatter):
    """JSON formatter that always includes structured defaults."""

    def add_fields(self, log_record: dict[str, Any], record: logging.LogRecord, message_dict: dict[str, Any]) -> None:
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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize and tear down external clients around app lifecycle."""

    metrics_task: asyncio.Task[None] | None = None

    healthy = await db.healthcheck()
    if not healthy:
        if settings.env.lower() == "production":
            raise RuntimeError("Supabase healthcheck failed during production startup")
        logger.warning("startup_supabase_unhealthy")

    app.state.start_time = monotonic()

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

    metrics_task = asyncio.create_task(_metrics_loop(), name="metrics-refresh-loop")

    try:
        yield
    finally:
        if metrics_task is not None:
            metrics_task.cancel()
            try:
                await metrics_task
            except asyncio.CancelledError:
                pass

        await groq_client.close()
        await redis_client.close()

        publisher = getattr(app.state, "redis_publisher", None)
        if publisher is not None:
            await publisher.close()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.state.start_time = monotonic()

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


@app.middleware("http")
async def limit_request_size(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Reject oversized request bodies before validation/parsing."""

    max_size = 1_048_576
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_size:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error_code": "payload_too_large",
                        "message": f"Request body exceeds maximum size of {max_size} bytes",
                    },
                )
        except ValueError:
            pass

    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Attach baseline security headers to all responses."""

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
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

    headers = dict(exc.headers) if exc.headers is not None else None

    return error_response(
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details,
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Map validation exceptions to 422 envelope responses."""

    return error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="One or more request fields are invalid.",
        details={"issues": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unexpected errors and return safe, descriptive responses."""

    request_id = getattr(request.state, "request_id", None)
    logger.exception("unhandled_exception", extra={"request_id": request_id, "error": str(exc)})
    return error_response(
        status_code=500,
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred. Please retry or contact support.",
    )


@app.get("/health")
async def health(request: Request) -> dict[str, Any]:
    """Return service health with dependency states and response latency."""

    start = monotonic()
    deps: dict[str, str] = {}

    try:
        deps["postgres"] = "ok" if await db.healthcheck() else "error: HealthcheckFailed"
    except Exception as exc:  # noqa: BLE001
        deps["postgres"] = f"error: {type(exc).__name__}"

    try:
        redis = await redis_client.get_client()
        ping_result = redis.ping()
        if not isinstance(ping_result, bool):
            await ping_result
        deps["valkey"] = "ok"
    except Exception as exc:  # noqa: BLE001
        deps["valkey"] = f"error: {type(exc).__name__}"

    try:
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY not set")
        deps["groq"] = "ok"
    except Exception as exc:  # noqa: BLE001
        deps["groq"] = f"error: {type(exc).__name__}"

    elapsed = round((monotonic() - start) * 1000, 2)
    all_ok = all(value == "ok" for value in deps.values())
    started_at = float(getattr(request.app.state, "start_time", monotonic()))

    return {
        "status": "ok" if all_ok else "degraded",
        "version": settings.app_version,
        "uptime": round(monotonic() - started_at, 2),
        "response_time_ms": elapsed,
        "dependencies": deps,
    }


@app.get("/metrics")
async def metrics() -> Response:
    """Prometheus scraping endpoint for operational telemetry."""

    return metrics_response()


app.include_router(auth.router)
app.include_router(calls.router)
app.include_router(runtime_config.router)
app.include_router(organizations.router)
app.include_router(channels.router)
app.include_router(messages.router)
app.include_router(translate.router)
app.include_router(understand.router)
app.include_router(carbon.router)
app.include_router(pulse.router)
app.include_router(users.router)
app.include_router(mesh.router)
