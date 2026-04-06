"""FastAPI application entrypoint for Spann backend services."""

from __future__ import annotations

import logging
from logging.config import dictConfig
from time import monotonic

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger

from app.config import settings
from app.database import db
from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import rate_limiter
from app.middleware.request_context import RequestContextMiddleware
from app.routers import auth, carbon, channels, mesh, messages, pulse, translate, users
from app.schemas.common import error_response, success_response
from app.services.groq_client import groq_client
from app.services.redis_client import redis_client


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
                "level": "INFO",
            },
        }
    )


configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version="1.0.0")
APP_START_MONOTONIC = monotonic()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", settings.request_id_header],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(AuthMiddleware)


@app.middleware("http")
async def enforce_public_rate_limit(request: Request, call_next):
    """Apply baseline rate limit to all public-facing endpoints."""

    if request.url.path in {"/health", "/docs", "/redoc", "/openapi.json"}:
        return await call_next(request)

    user_id = getattr(request.state, "user_id", None)
    source_ip = request.client.host if request.client else "unknown"
    identity = str(user_id or source_ip)

    try:
        await rate_limiter.enforce(
            identity=identity,
            bucket="public",
            limit=settings.default_public_rate_limit_per_minute,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return error_response(
            status_code=429,
            code=detail.get("code", "RATE_LIMITED"),
            message=detail.get("message", "Rate limit exceeded."),
        )

    return await call_next(request)


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

    return error_response(status_code=exc.status_code, code=code, message=message, details=details)


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

    healthy = await db.healthcheck()
    if not healthy:
        logger.warning("startup_supabase_unhealthy")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Close outgoing network clients cleanly."""

    await groq_client.close()
    await redis_client.close()


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


app.include_router(auth.router)
app.include_router(channels.router)
app.include_router(messages.router)
app.include_router(translate.router)
app.include_router(carbon.router)
app.include_router(pulse.router)
app.include_router(users.router)
app.include_router(mesh.router)
