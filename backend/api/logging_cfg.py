"""
structlog configuration for the Spann accessibility API.

Call `configure_logging()` once at startup (before any loggers are created).

In development:  colorised, human-readable ConsoleRenderer
In production:   compact JSON — one object per line, ingested by log aggregators

Usage::

    import structlog
    logger = structlog.get_logger(__name__)
    logger.info("workspace_registered", workspace_id=wid, platform="slack")
"""

from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(env: str = "development", log_level: str = "INFO") -> None:
    """
    Wire structlog to the Python stdlib logging bridge.

    Parameters
    ----------
    env:
        "production" activates JSON output; anything else uses ConsoleRenderer.
    log_level:
        Standard Python log level name, e.g. "DEBUG", "INFO", "WARNING".
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    # ── Shared pre-chain processors ───────────────────────────────────────────
    # These run on every log call regardless of renderer.
    shared_processors: list[structlog.types.Processor] = [
        # Bind request-scoped context (set via structlog.contextvars.bind_contextvars)
        structlog.contextvars.merge_contextvars,
        # Add log level name ("info", "warning", ...)
        structlog.stdlib.add_log_level,
        # Add the logger name (__name__ of the caller)
        structlog.stdlib.add_logger_name,
        # ISO-8601 timestamp
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        # Render exception tracebacks inline
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    # ── Renderer — JSON in prod, pretty-print in dev ──────────────────────────
    if env.lower() == "production":
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True, exception_formatter=structlog.dev.plain_traceback)

    structlog.configure(
        processors=shared_processors
        + [
            # Needed for the stdlib integration: formats the final event dict
            # before passing it to logging.Logger
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # ── Wire to stdlib so uvicorn/httpx/supabase logs flow through structlog ──
    formatter = structlog.stdlib.ProcessorFormatter(
        # foreign_pre_chain runs on records originating from stdlib loggers
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level)

    # Suppress overly-verbose third-party loggers
    for noisy in ("httpx", "httpcore", "hpack", "h2"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def bind_request_context(request_id: str, path: str, method: str) -> None:
    """
    Bind per-request fields into structlog's contextvars store.
    Called by the request-ID middleware — automatically included in every
    log line emitted during the lifetime of that request.
    """
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        path=path,
        method=method,
    )
