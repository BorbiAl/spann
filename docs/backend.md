# Spann Backend Documentation

## Overview
The Spann backend is a FastAPI service that provides:
- authentication and token lifecycle endpoints
- channel and message APIs for team chat
- translation and communication support APIs
- carbon tracking and leaderboard APIs
- mesh node registration and sync APIs
- metrics and health endpoints for operations

Main entrypoint: [backend/app/main.py](backend/app/main.py)

## Tech Stack
- FastAPI + Uvicorn
- Pydantic v2 / pydantic-settings
- Supabase client
- Redis/Valkey
- Celery (worker + beat)
- Prometheus client metrics

Dependencies are defined in [backend/requirements.txt](backend/requirements.txt).

## Service Architecture
Core app modules:
- [backend/app/main.py](backend/app/main.py): app creation, middleware, routers, exception handlers, health/metrics routes
- [backend/app/config.py](backend/app/config.py): environment-driven settings
- [backend/app/database.py](backend/app/database.py): data access and persistence logic
- [backend/app/middleware/auth.py](backend/app/middleware/auth.py): JWT auth gate and request-id propagation
- [backend/app/middleware/rate_limit.py](backend/app/middleware/rate_limit.py): Redis sliding-window rate limiting with local fallback
- [backend/app/metrics.py](backend/app/metrics.py): Prometheus metrics and middleware instrumentation

Router modules:
- [backend/app/routers/auth.py](backend/app/routers/auth.py)
- [backend/app/routers/channels.py](backend/app/routers/channels.py)
- [backend/app/routers/messages.py](backend/app/routers/messages.py)
- [backend/app/routers/translate.py](backend/app/routers/translate.py)
- [backend/app/routers/carbon.py](backend/app/routers/carbon.py)
- [backend/app/routers/pulse.py](backend/app/routers/pulse.py)
- [backend/app/routers/users.py](backend/app/routers/users.py)
- [backend/app/routers/mesh.py](backend/app/routers/mesh.py)

## Runtime Modes
### Standard mode
Uses Supabase and Redis/Valkey as primary backends.

### TEST_MODE
Controlled by `TEST_MODE` in [backend/app/config.py](backend/app/config.py).
When enabled, backend uses in-memory local storage paths for major flows to support deterministic test/probe scenarios.

### Auth fallback mode
Controlled by `AUTH_FALLBACK_ENABLED` in [backend/app/config.py](backend/app/config.py).
When enabled, auth-related flows can gracefully use local fallback state if Supabase auth responses fail in runtime environments.
Default is `false`, and production validation blocks enabling it.

## API Behavior
### Response envelope
Success and error responses are standardized in [backend/app/schemas/common.py](backend/app/schemas/common.py):
- success: `{ data, error: null, status }`
- errors: `{ data: null, error, detail, status }`

`success_response` also mirrors dictionary payload keys at top-level for compatibility with existing clients.

## Authentication and Authorization
Auth middleware in [backend/app/middleware/auth.py](backend/app/middleware/auth.py):
- validates `Authorization: Bearer <jwt>`
- requires token claims: `sub`, `iat`, `exp`, `jti`, `workspace_id`
- adds request id header (`X-Request-ID`) to responses

Unprotected paths include:
- `/health`, `/metrics`
- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/magic-link`
- `/mesh/sync`
- docs/openapi paths

Auth routes in [backend/app/routers/auth.py](backend/app/routers/auth.py):
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/magic-link`

## Rate Limiting
Rate limiter in [backend/app/middleware/rate_limit.py](backend/app/middleware/rate_limit.py):
- Redis sorted-set sliding window
- fail-open local in-memory fallback when Redis is unavailable
- returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

Route buckets:
- auth: `settings.auth_rate_limit_per_minute` (default 10)
- messages: `settings.messages_rate_limit_per_minute` (default 60)
- translate: `settings.translate_rate_limit_per_minute` (default 100)
- public routes: fixed 200/min by IP

## Endpoint Map
### System
- `GET /health`
- `GET /metrics`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/magic-link`

### Channels
- `GET /channels`
- `POST /channels`

### Messages
- `POST /messages`
- `GET /channels/{channel_id}/messages`
- `PATCH /messages/{message_id}`
- `DELETE /messages/{message_id}`
- `POST /messages/{message_id}/reactions`

### Translation
- `POST /translate`

### Carbon
- `GET /carbon/leaderboard`
- `POST /carbon/log`

### Pulse
- `GET /pulse/{channel_id}`

### Users
- `PATCH /users/me/preferences`

### Mesh
- `POST /mesh/register`
- `GET /mesh/nodes`
- `POST /mesh/nodes/{node_id}/revoke`
- `POST /mesh/sync`

## Background Tasks
Celery bootstrap: [backend/app/tasks/worker.py](backend/app/tasks/worker.py)

Task modules:
- [backend/app/tasks/sentiment.py](backend/app/tasks/sentiment.py)
- [backend/app/tasks/coaching.py](backend/app/tasks/coaching.py)
- [backend/app/tasks/carbon.py](backend/app/tasks/carbon.py)

Message and carbon routes dispatch tasks in standard mode; task dispatch is skipped in TEST_MODE to keep probes deterministic.

## Metrics and Observability
Metrics module: [backend/app/metrics.py](backend/app/metrics.py)

Collected signals include:
- HTTP request counts/errors/latency
- Groq call counts/errors/latency
- rate-limit hits
- message send counters
- mesh sync counters
- carbon log counters
- websocket connection gauge
- Celery queue depth gauges
- Redis connectivity gauge

Structured JSON logging is configured in [backend/app/main.py](backend/app/main.py).

## Configuration
Primary settings are in [backend/app/config.py](backend/app/config.py).
Important environment variables:
- `ENV`, `LOG_LEVEL`, `API_HOST`, `API_PORT`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_USE_SERVICE_ROLE`
- `GROQ_API_KEY`, `GROQ_MODEL`
- `REDIS_URL`
- `JWT_SECRET`, `JWT_ALGORITHM`
- `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- `ALLOWED_ORIGINS`
- `TEST_MODE`
- `AUTH_FALLBACK_ENABLED`

Production startup/validation protections:
- `TEST_MODE` must be `false`
- `AUTH_FALLBACK_ENABLED` must be `false`
- `ALLOWED_ORIGINS` cannot contain `*`
- `JWT_SECRET` must be at least 32 characters
- Supabase URL + API key must be configured
- backend startup fails in production if Supabase healthcheck is unhealthy

## Local Run
From repository root, scripts in [package.json](package.json):
- `npm run backend` starts Uvicorn with app-dir `backend`
- backend default URL: `http://localhost:8000`

## Docker Run
Compose file: [docker-compose.yml](docker-compose.yml)

Backend-related services:
- `backend`
- `backend-worker`
- `backend-beat`
- `valkey`

Additional realtime/mesh services in the same compose stack:
- `chat-server`
- `mesh-relay`
- `mesh-daemon`

## Testing
Pytest config: [backend/pytest.ini](backend/pytest.ini)

Make targets from [Makefile](Makefile):
- `make test`
- `make test-cov`
- `make test-fast`
- `make test-auth`
- `make test-security`

Current coverage scope can be configured via [backend/.coveragerc](backend/.coveragerc).

## Notes for Maintainers
- Database and auth behavior include fallback paths to support local/dev and resilience scenarios.
- Keep auth claims (`sub`, `jti`, `workspace_id`) consistent across token issuers/validators.
- If changing envelope shape, update clients expecting top-level mirrored keys from success responses.
