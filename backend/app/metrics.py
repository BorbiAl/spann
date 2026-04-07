"""Prometheus metrics for Spann backend services."""

from __future__ import annotations

import hashlib
import time
from collections.abc import Awaitable, Callable

from fastapi import Request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

DEFAULT_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)


http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)
http_request_errors_total = Counter(
    "http_request_errors_total",
    "Total HTTP request errors",
    ["method", "endpoint", "error_type"],
)
groq_api_calls_total = Counter(
    "groq_api_calls_total",
    "Total Groq API calls",
    ["task_type"],
)
groq_api_errors_total = Counter(
    "groq_api_errors_total",
    "Total Groq API errors",
    ["task_type", "error_type"],
)
rate_limit_hits_total = Counter(
    "rate_limit_hits_total",
    "Total rate-limit rejections",
    ["bucket"],
)
messages_sent_total = Counter(
    "messages_sent_total",
    "Total sent messages",
    ["workspace_id"],
)
mesh_sync_requests_total = Counter(
    "mesh_sync_requests_total",
    "Total mesh sync requests",
    ["node_id"],
)
carbon_logs_total = Counter(
    "carbon_logs_total",
    "Total carbon logs",
    ["transport_type"],
)

active_websocket_connections = Gauge(
    "active_websocket_connections",
    "Active websocket connections from chat service redis counter",
)
celery_queue_depth = Gauge(
    "celery_queue_depth",
    "Approximate celery queue depth",
    ["queue_name"],
)
redis_connected = Gauge(
    "redis_connected",
    "Redis connectivity state (1 connected, 0 disconnected)",
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=DEFAULT_BUCKETS,
)
groq_api_latency_seconds = Histogram(
    "groq_api_latency_seconds",
    "Groq request duration in seconds",
    ["task_type"],
    buckets=DEFAULT_BUCKETS,
)
db_query_duration_seconds = Histogram(
    "db_query_duration_seconds",
    "Database operation duration in seconds",
    ["operation"],
    buckets=DEFAULT_BUCKETS,
)


def hash_identifier(value: str) -> str:
    """Hash potentially sensitive identifiers before metrics labeling."""

    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class MetricsMiddleware(BaseHTTPMiddleware):
    """Collect request-level HTTP metrics for all API endpoints."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        start = time.perf_counter()
        method = request.method
        endpoint = request.url.path

        try:
            response = await call_next(request)
            status = str(response.status_code)
            http_requests_total.labels(method=method, endpoint=endpoint, status_code=status).inc()

            headers = getattr(request.state, "rate_limit_headers", None)
            if isinstance(headers, dict):
                for header_name, header_value in headers.items():
                    response.headers[header_name] = str(header_value)

            if response.status_code >= 400:
                http_request_errors_total.labels(method=method, endpoint=endpoint, error_type=status).inc()

            return response
        except Exception as exc:  # noqa: BLE001
            http_request_errors_total.labels(method=method, endpoint=endpoint, error_type=type(exc).__name__).inc()
            raise
        finally:
            http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(time.perf_counter() - start)


def metrics_response() -> Response:
    """Render metrics as Prometheus text exposition format."""

    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


async def refresh_infra_metrics(redis: Redis) -> None:
    """Refresh infra gauges from Redis counters and queue lengths."""

    ws_value = await redis.get("chat:active_websocket_connections")
    if ws_value is not None:
        try:
            active_websocket_connections.set(float(ws_value))
        except ValueError:
            pass

    for queue_name in ("celery", "celery.priority", "celery.low"):
        depth_result = redis.llen(queue_name)
        if isinstance(depth_result, int):
            depth = depth_result
        else:
            depth = await depth_result
        celery_queue_depth.labels(queue_name=queue_name).set(float(depth))
