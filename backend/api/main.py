"""
Spann Accessibility Plugin — FastAPI application
backend/api/main.py

Endpoints
---------
POST /api/workspaces/register          — Register a new platform workspace on install
GET  /api/users/{platform_user_id}/profile  — Fetch accessibility profile
POST /api/users/{platform_user_id}/profile  — Create / update accessibility profile
POST /api/messages/process             — AI-process a message (≤ 800 ms SLA)
POST /api/messages/summarize-thread    — Summarise a thread of platform messages
GET  /api/workspaces/{workspace_id}/stats   — Usage stats for the dashboard
POST /api/webhooks/stripe              — Stripe billing webhook
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, Any, AsyncGenerator

import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as SupabaseAPIError
from pydantic import BaseModel, Field
from supabase import AsyncClient

from .database import SupabaseClient, close_db, get_db, init_db
from .groq import GroqClient, GroqError, GroqParseError, GroqTimeoutError, close_groq, get_groq, init_groq
from .logging_cfg import bind_request_context, configure_logging
from .models import (
    DisabilityTypeEnum,
    MessageContextIn,
    PlanEnum,
    ProcessedMessageOut,
    ProfileIn,
    ProfileOut,
    SubscriptionStatusEnum,
    ToneIndicatorEnum,
    WorkspaceRegisterIn,
    WorkspaceRegisterOut,
    WorkspaceStatsOut,
)

logger = structlog.get_logger(__name__)

# =============================================================================
# Application lifespan
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown hooks: initialise and teardown shared clients."""
    env = os.environ.get("ENV", "development")
    log_level = os.environ.get("LOG_LEVEL", "INFO")

    configure_logging(env=env, log_level=log_level)
    logger.info("spann_api_starting", env=env)

    await init_db()
    init_groq()

    logger.info("spann_api_ready")
    yield

    logger.info("spann_api_shutting_down")
    await close_groq()
    await close_db()
    logger.info("spann_api_stopped")


# =============================================================================
# Application instance
# =============================================================================

app = FastAPI(
    title="Spann Accessibility API",
    version="0.2.0",
    description="REST API powering the Spann accessibility plugin for Slack, Teams, and Discord.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

_allowed_origins = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# =============================================================================
# Middleware
# =============================================================================


@app.middleware("http")
async def request_context_middleware(request: Request, call_next: Any) -> Any:
    """Attach a stable request-ID and bind it to structlog's contextvars."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    bind_request_context(
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )
    t0 = time.monotonic()
    response = await call_next(request)
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "http_request",
        status=response.status_code,
        elapsed_ms=elapsed_ms,
    )
    return response


# =============================================================================
# Dependencies
# =============================================================================

DbDep = Annotated[SupabaseClient, Depends(get_db)]
GroqDep = Annotated[GroqClient, Depends(get_groq)]


# =============================================================================
# Exception handlers
# =============================================================================


@app.exception_handler(SupabaseAPIError)
async def supabase_error_handler(request: Request, exc: SupabaseAPIError) -> JSONResponse:
    logger.error("supabase_api_error", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"code": "SUPABASE_ERROR", "message": "Database operation failed."},
    )


@app.exception_handler(GroqTimeoutError)
async def groq_timeout_handler(request: Request, exc: GroqTimeoutError) -> JSONResponse:
    logger.warning("groq_timeout", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        content={"code": "AI_TIMEOUT", "message": "AI processing timed out."},
    )


@app.exception_handler(GroqError)
async def groq_error_handler(request: Request, exc: GroqError) -> JSONResponse:
    logger.error("groq_error", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"code": "AI_ERROR", "message": "AI processing failed."},
    )


# =============================================================================
# Helpers
# =============================================================================


async def _audit(
    db: AsyncClient,
    workspace_id: str,
    action: str,
    metadata: dict[str, Any],
    user_id: str | None = None,
) -> None:
    """Fire-and-forget audit log insert. Errors are logged, never raised."""
    try:
        await db.table("audit_log").insert(
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "action": action,
                "metadata": metadata,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("audit_insert_failed", action=action, error=str(exc))


def _row_to_workspace(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "platform": row["platform"],
        "platform_workspace_id": row["platform_workspace_id"],
        "name": row["name"],
        "plan": row["plan"],
        "created_at": row["created_at"],
    }


def _row_to_subscription(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "workspace_id": str(row["workspace_id"]),
        "plan": row["plan"],
        "seats": row["seats"],
        "status": row["status"],
        "current_period_end": row.get("current_period_end"),
    }


def _row_to_profile(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "disability_types": row.get("disability_types") or [],
        "settings": row.get("settings") or {},
        "updated_at": row["updated_at"],
    }


# =============================================================================
# Health
# =============================================================================


@app.get("/health", tags=["system"], summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "spann-accessibility-api", "version": "0.2.0"}


# =============================================================================
# POST /api/workspaces/register
# =============================================================================


@app.post(
    "/api/workspaces/register",
    response_model=WorkspaceRegisterOut,
    status_code=status.HTTP_201_CREATED,
    tags=["workspaces"],
    summary="Register a new platform workspace (called on app install)",
)
async def register_workspace(
    body: WorkspaceRegisterIn,
    db: DbDep,
) -> WorkspaceRegisterOut:
    """
    Called by the platform bot the first time it is installed in a workspace.

    Upserts the workspace row (idempotent — safe to call on reinstall) and
    creates a free-tier subscription if one does not already exist.
    """
    log = logger.bind(
        platform=body.platform.value,
        platform_workspace_id=body.platform_workspace_id,
    )
    log.info("workspace_register_start")

    # ── Upsert workspace ──────────────────────────────────────────────────────
    try:
        ws_result = (
            await db.table("workspaces")
            .upsert(
                {
                    "platform": body.platform.value,
                    "platform_workspace_id": body.platform_workspace_id,
                    "name": body.name,
                },
                on_conflict="platform,platform_workspace_id",
            )
            .execute()
        )
    except SupabaseAPIError as exc:
        log.error("workspace_upsert_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to register workspace.",
        ) from exc

    if not ws_result.data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Workspace upsert returned no data.",
        )

    ws_row = ws_result.data[0]
    workspace_id = str(ws_row["id"])

    # ── Upsert subscription (free by default) ─────────────────────────────────
    sub_payload: dict[str, Any] = {
        "workspace_id": workspace_id,
        "plan": PlanEnum.FREE.value,
        "seats": 5,
        "status": SubscriptionStatusEnum.ACTIVE.value,
    }
    if body.billing_email:
        sub_payload["billing_email"] = body.billing_email

    try:
        sub_result = (
            await db.table("subscriptions")
            .upsert(sub_payload, on_conflict="workspace_id")
            .execute()
        )
    except SupabaseAPIError as exc:
        log.error("subscription_upsert_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create subscription.",
        ) from exc

    sub_row = sub_result.data[0]

    # ── Audit ─────────────────────────────────────────────────────────────────
    await _audit(
        db,
        workspace_id=workspace_id,
        action="workspace.register",
        metadata={
            "platform": body.platform.value,
            "platform_workspace_id": body.platform_workspace_id,
        },
    )

    log.info("workspace_register_ok", workspace_id=workspace_id)
    return WorkspaceRegisterOut(
        workspace=_row_to_workspace(ws_row),  # type: ignore[arg-type]
        subscription=_row_to_subscription(sub_row),  # type: ignore[arg-type]
    )


# =============================================================================
# GET /api/users/{platform_user_id}/profile
# =============================================================================


@app.get(
    "/api/users/{platform_user_id}/profile",
    response_model=ProfileOut,
    tags=["profiles"],
    summary="Fetch a user's accessibility profile",
)
async def get_profile(
    platform_user_id: str,
    workspace_id: str,
    platform: str,
    db: DbDep,
) -> ProfileOut:
    """
    Returns the user's accessibility profile.

    Query parameters:
    - **workspace_id** — UUID of the workspace
    - **platform** — one of `slack` | `teams` | `discord`
    """
    log = logger.bind(platform_user_id=platform_user_id, workspace_id=workspace_id)

    # Resolve internal user record
    user_result = (
        await db.table("users")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("platform_user_id", platform_user_id)
        .maybe_single()
        .execute()
    )

    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found for platform_user_id={platform_user_id!r} in workspace {workspace_id!r}.",
        )

    user_id = str(user_result.data["id"])

    # Fetch profile
    profile_result = (
        await db.table("accessibility_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No accessibility profile found for user {user_id!r}.",
        )

    log.info("profile_fetched", user_id=user_id)
    return ProfileOut(**_row_to_profile(profile_result.data))


# =============================================================================
# POST /api/users/{platform_user_id}/profile
# =============================================================================


@app.post(
    "/api/users/{platform_user_id}/profile",
    response_model=ProfileOut,
    tags=["profiles"],
    summary="Create or update a user's accessibility profile",
)
async def upsert_profile(
    platform_user_id: str,
    body: ProfileIn,
    db: DbDep,
) -> ProfileOut:
    """
    Idempotent upsert — creates the user and profile on first call, updates
    on subsequent calls.  The disability_types list replaces the existing value.
    """
    log = logger.bind(
        platform_user_id=platform_user_id,
        workspace_id=body.workspace_id,
        disability_types=[d.value for d in body.disability_types],
    )
    log.info("profile_upsert_start")

    # ── Upsert user ───────────────────────────────────────────────────────────
    user_payload: dict[str, Any] = {
        "workspace_id": body.workspace_id,
        "platform_user_id": platform_user_id,
    }
    if body.display_name:
        user_payload["display_name"] = body.display_name
    if body.email:
        user_payload["email"] = body.email

    user_result = (
        await db.table("users")
        .upsert(user_payload, on_conflict="workspace_id,platform_user_id")
        .execute()
    )

    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upsert user record.",
        )
    user_id = str(user_result.data[0]["id"])

    # ── Upsert profile ────────────────────────────────────────────────────────
    profile_payload: dict[str, Any] = {
        "user_id": user_id,
        "disability_types": [d.value for d in body.disability_types],
        "settings": body.settings,
    }

    profile_result = (
        await db.table("accessibility_profiles")
        .upsert(profile_payload, on_conflict="user_id")
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upsert accessibility profile.",
        )

    profile_row = profile_result.data[0]

    await _audit(
        db,
        workspace_id=body.workspace_id,
        action="profile.upsert",
        metadata={
            "disability_types": [d.value for d in body.disability_types],
            "platform_user_id": platform_user_id,
        },
        user_id=user_id,
    )

    log.info("profile_upsert_ok", user_id=user_id, profile_id=str(profile_row["id"]))
    return ProfileOut(**_row_to_profile(profile_row))


# =============================================================================
# POST /api/messages/process
# =============================================================================


@app.post(
    "/api/messages/process",
    response_model=ProcessedMessageOut,
    tags=["messages"],
    summary="AI-process an incoming message (≤ 800 ms SLA)",
)
async def process_message(
    body: MessageContextIn,
    db: DbDep,
    groq: GroqDep,
) -> ProcessedMessageOut:
    """
    Runs a message through the Spann AI accessibility pipeline.

    1. Looks up the author's accessibility profile (for target reading level).
    2. Calls Groq concurrently for simplification and tone classification.
    3. Persists the result in `messages_processed`.
    4. Returns within 800 ms (Groq calls time out at 700 ms each).

    The endpoint never returns an error purely because AI failed — it degrades
    gracefully by returning the original text with a NEUTRAL tone.
    """
    t_start = time.monotonic()
    log = logger.bind(
        workspace_id=body.workspace_id,
        author_id=body.author_id,
        platform=body.platform_id.value,
    )
    log.info("message_process_start", text_len=len(body.raw_text))

    # ── 1. Resolve profile for personalised reading level ─────────────────────
    reading_level = 8  # default: grade 8 (standard news writing)
    user_id: str | None = None

    try:
        user_result = (
            await db.table("users")
            .select("id")
            .eq("workspace_id", body.workspace_id)
            .eq("platform_user_id", body.author_id)
            .maybe_single()
            .execute()
        )
        if user_result.data:
            user_id = str(user_result.data["id"])
            profile_result = (
                await db.table("accessibility_profiles")
                .select("settings, disability_types")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if profile_result.data:
                cognitive = (profile_result.data.get("settings") or {}).get("cognitive", {})
                if isinstance(cognitive, dict):
                    reading_level = int(cognitive.get("targetReadingLevel", reading_level))
    except Exception as exc:  # noqa: BLE001
        # Profile lookup failure must never block message processing
        log.warning("profile_lookup_failed", error=str(exc))

    # ── 2. Concurrent Groq calls ──────────────────────────────────────────────
    # Both calls share the 700 ms httpx timeout.  asyncio.gather runs them in
    # parallel so total AI time ≈ max(simplify_ms, tone_ms), not the sum.
    simplified_text = body.raw_text
    tone = ToneIndicatorEnum.NEUTRAL

    try:
        simplified_result, tone_result = await asyncio.gather(
            groq.simplify(body.raw_text, reading_level),
            groq.analyze_tone(body.raw_text),
            return_exceptions=True,
        )

        if isinstance(simplified_result, Exception):
            log.warning("simplify_failed", error=str(simplified_result))
        else:
            simplified_text = simplified_result

        if isinstance(tone_result, (GroqParseError, GroqError, Exception)):
            log.warning("tone_analysis_failed", error=str(tone_result))
        else:
            tone = ToneIndicatorEnum(tone_result)

    except Exception as exc:  # noqa: BLE001
        log.error("groq_gather_failed", error=str(exc))
        # Degrade gracefully — continue with original text

    ai_ms = int((time.monotonic() - t_start) * 1000)

    # ── 3. Persist to messages_processed ─────────────────────────────────────
    insert_payload: dict[str, Any] = {
        "workspace_id": body.workspace_id,
        "platform": body.platform_id.value,
        "original_text": body.raw_text,
        "processed_text": simplified_text,
        "tone_indicator": tone.value,
        "reading_level": max(1, min(12, reading_level)),
        "processing_ms": ai_ms,
    }
    if user_id:
        insert_payload["user_id"] = user_id

    try:
        insert_result = (
            await db.table("messages_processed")
            .insert(insert_payload)
            .execute()
        )
        message_id = str(insert_result.data[0]["id"])
    except Exception as exc:  # noqa: BLE001
        log.error("message_insert_failed", error=str(exc))
        # Assign a synthetic ID so the response schema is satisfied
        message_id = str(uuid.uuid4())

    total_ms = int((time.monotonic() - t_start) * 1000)
    log.info(
        "message_process_ok",
        message_id=message_id,
        tone=tone.value,
        reading_level=reading_level,
        total_ms=total_ms,
    )

    return ProcessedMessageOut(
        message_id=message_id,
        original_text=body.raw_text,
        simplified=simplified_text,
        tone_indicator=tone,
        reading_level=max(1, min(12, reading_level)),
        processing_ms=total_ms,
    )


# =============================================================================
# GET /api/workspaces/{workspace_id}/stats
# =============================================================================


@app.get(
    "/api/workspaces/{workspace_id}/stats",
    response_model=WorkspaceStatsOut,
    tags=["workspaces"],
    summary="Usage stats for the admin dashboard",
)
async def get_workspace_stats(
    workspace_id: str,
    db: DbDep,
) -> WorkspaceStatsOut:
    """
    Returns aggregated usage data for the given workspace.

    - **total_messages_processed** — all-time count
    - **messages_this_month** — calendar month to date (UTC)
    - **active_users_this_month** — distinct users who had a message processed this month
    - **avg_processing_ms** — average AI pipeline latency this month
    """
    log = logger.bind(workspace_id=workspace_id)

    # Verify workspace exists
    ws_result = (
        await db.table("workspaces")
        .select("id")
        .eq("id", workspace_id)
        .maybe_single()
        .execute()
    )
    if not ws_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace {workspace_id!r} not found.",
        )

    # Fetch subscription
    sub_result = (
        await db.table("subscriptions")
        .select("plan, seats")
        .eq("workspace_id", workspace_id)
        .maybe_single()
        .execute()
    )
    plan = PlanEnum(sub_result.data["plan"]) if sub_result.data else PlanEnum.FREE
    seats = int(sub_result.data["seats"]) if sub_result.data else 5

    # All-time message count — use Supabase count aggregate
    total_result = (
        await db.table("messages_processed")
        .select("id", count="exact")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    total_messages = total_result.count or 0

    # This-month stats — use a date filter
    from datetime import UTC, datetime

    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_iso = month_start.isoformat()

    month_result = (
        await db.table("messages_processed")
        .select("user_id, processing_ms", count="exact")
        .eq("workspace_id", workspace_id)
        .gte("created_at", month_iso)
        .execute()
    )
    messages_this_month = month_result.count or 0
    rows = month_result.data or []

    active_users = len({r["user_id"] for r in rows if r.get("user_id")})
    avg_ms: float | None = None
    ms_values = [r["processing_ms"] for r in rows if r.get("processing_ms") is not None]
    if ms_values:
        avg_ms = round(sum(ms_values) / len(ms_values), 1)

    log.info(
        "stats_fetched",
        total=total_messages,
        this_month=messages_this_month,
        active_users=active_users,
    )

    return WorkspaceStatsOut(
        workspace_id=workspace_id,
        plan=plan,
        seats=seats,
        total_messages_processed=total_messages,
        messages_this_month=messages_this_month,
        active_users_this_month=active_users,
        avg_processing_ms=avg_ms,
    )


# =============================================================================
# POST /api/webhooks/stripe
# =============================================================================

_STRIPE_TOLERANCE_SECONDS = 300  # 5 minutes


def _verify_stripe_signature(
    payload: bytes,
    signature_header: str,
    secret: str,
) -> None:
    """
    Verify the Stripe webhook signature using HMAC-SHA256.

    Raises HTTPException(400) on any verification failure — invalid header
    format, expired timestamp, or bad signature.
    """
    try:
        parts = dict(
            item.split("=", 1)
            for item in signature_header.split(",")
            if "=" in item
        )
        timestamp = parts.get("t")
        v1_sig = parts.get("v1")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed Stripe-Signature header.",
        ) from exc

    if not timestamp or not v1_sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe-Signature header missing 't' or 'v1' component.",
        )

    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe-Signature 't' is not a valid integer.",
        ) from exc

    if abs(time.time() - ts) > _STRIPE_TOLERANCE_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe webhook timestamp is outside the 5-minute tolerance window.",
        )

    signed_payload = f"{timestamp}.{payload.decode('utf-8', errors='replace')}"
    expected = hmac.new(
        secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, v1_sig):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe webhook signature verification failed.",
        )


@app.post(
    "/api/webhooks/stripe",
    status_code=status.HTTP_200_OK,
    tags=["billing"],
    summary="Stripe billing webhook receiver",
)
async def stripe_webhook(
    request: Request,
    db: DbDep,
    stripe_signature: str = Header(..., alias="stripe-signature"),
) -> dict[str, bool]:
    """
    Handles Stripe events to keep the `subscriptions` table in sync.

    Supported events:
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`

    Returns `{"received": true}` for all accepted events, including unknown
    ones (per Stripe's recommendation — always return 200 to prevent retries).
    """
    payload = await request.body()
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    if not webhook_secret:
        logger.warning("stripe_webhook_secret_not_set")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe webhook secret is not configured.",
        )

    _verify_stripe_signature(payload, stripe_signature, webhook_secret)

    event: dict[str, Any] = await request.json()
    event_type: str = event.get("type", "")
    event_data: dict[str, Any] = event.get("data", {}).get("object", {})

    log = logger.bind(stripe_event_type=event_type, stripe_event_id=event.get("id"))
    log.info("stripe_webhook_received")

    # ── customer.subscription.created / updated ───────────────────────────────
    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        stripe_sub_id: str = event_data.get("id", "")
        raw_status: str = event_data.get("status", "active")
        period_end_ts: int | None = event_data.get("current_period_end")
        # Map Stripe plan nickname / metadata to our plan enum
        raw_plan = (
            (event_data.get("metadata") or {}).get("spann_plan")
            or event_data.get("plan", {}).get("nickname", "")
            or "free"
        ).lower()
        plan = raw_plan if raw_plan in PlanEnum._value2member_map_ else "free"

        period_end_iso: str | None = None
        if period_end_ts:
            from datetime import UTC, datetime
            period_end_iso = datetime.fromtimestamp(period_end_ts, UTC).isoformat()

        try:
            await (
                db.table("subscriptions")
                .update(
                    {
                        "stripe_subscription_id": stripe_sub_id,
                        "status": raw_status,
                        "plan": plan,
                        "current_period_end": period_end_iso,
                    }
                )
                .eq("stripe_subscription_id", stripe_sub_id)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            log.error("stripe_subscription_update_failed", error=str(exc))

    # ── customer.subscription.deleted ────────────────────────────────────────
    elif event_type == "customer.subscription.deleted":
        stripe_sub_id = event_data.get("id", "")
        try:
            await (
                db.table("subscriptions")
                .update({"status": SubscriptionStatusEnum.CANCELED.value, "plan": PlanEnum.FREE.value})
                .eq("stripe_subscription_id", stripe_sub_id)
                .execute()
            )
            log.info("subscription_canceled", stripe_sub_id=stripe_sub_id)
        except Exception as exc:  # noqa: BLE001
            log.error("subscription_cancel_failed", error=str(exc))

    # ── invoice.payment_failed ────────────────────────────────────────────────
    elif event_type == "invoice.payment_failed":
        stripe_sub_id = event_data.get("subscription", "")
        try:
            await (
                db.table("subscriptions")
                .update({"status": SubscriptionStatusEnum.PAST_DUE.value})
                .eq("stripe_subscription_id", stripe_sub_id)
                .execute()
            )
            log.warning("subscription_past_due", stripe_sub_id=stripe_sub_id)
        except Exception as exc:  # noqa: BLE001
            log.error("past_due_update_failed", error=str(exc))

    else:
        log.debug("stripe_event_unhandled")

    return {"received": True}


# =============================================================================
# POST /api/messages/summarize-thread
# =============================================================================


class ThreadMessage(BaseModel):
    """A single message in the thread to summarise."""

    author_id: str = Field(..., min_length=1, max_length=128)
    text: str = Field(..., min_length=1, max_length=2000)


class SummarizeThreadIn(BaseModel):
    """Payload sent by the Slack / Teams / Discord bots."""

    workspace_id: str = Field(..., min_length=1, max_length=64)
    platform_id: str = Field(..., min_length=1, max_length=16)
    messages: list[ThreadMessage] = Field(..., min_length=1, max_length=50)


class SummarizeThreadOut(BaseModel):
    """Two-sentence thread summary."""

    summary: str
    message_count: int


@app.post(
    "/api/messages/summarize-thread",
    response_model=SummarizeThreadOut,
    tags=["messages"],
    summary="Summarise a thread of platform messages",
)
async def summarize_thread(
    body: SummarizeThreadIn,
    groq: GroqDep,
) -> SummarizeThreadOut:
    """
    Accepts up to 50 messages from a platform thread and returns a two-sentence
    summary via Groq.

    Sentence 1: what the thread is about.
    Sentence 2: what conclusion or action was reached, or "No conclusion yet."
    """
    log = logger.bind(workspace_id=body.workspace_id, message_count=len(body.messages))
    log.info("summarize_thread_start")

    # Build a compact transcript (200-char cap per message)
    transcript_lines = []
    for i, msg in enumerate(body.messages, 1):
        preview = msg.text if len(msg.text) <= 200 else f"{msg.text[:197]}…"
        transcript_lines.append(f"[{i}] {msg.author_id}: {preview}")
    transcript = "\n".join(transcript_lines)

    # Call Groq with a two-sentence constraint
    messages = [
        {
            "role": "system",
            "content": (
                "You are an accessibility summarisation assistant. "
                "Summarise the thread in EXACTLY two sentences. "
                "Sentence 1: what the thread is about. "
                "Sentence 2: what conclusion or action was reached (or 'No conclusion yet.' if open). "
                "Output ONLY the two sentences."
            ),
        },
        {"role": "user", "content": f"Thread:\n\n{transcript}"},
    ]

    try:
        raw = await groq._complete(messages, temperature=0.2, max_tokens=128)
    except Exception as exc:
        log.error("summarize_thread_groq_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI summarisation failed. Please try again.",
        ) from exc

    # Enforce two-sentence output
    import re as _re
    sentences = _re.findall(r"[^.!?]+[.!?]+", raw)
    summary = " ".join(s.strip() for s in sentences[:2]).strip() or raw.strip()

    log.info("summarize_thread_ok", summary_len=len(summary))
    return SummarizeThreadOut(summary=summary, message_count=len(body.messages))
