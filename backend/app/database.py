"""Asynchronous Supabase database access layer with authorization and metrics."""

from __future__ import annotations

import asyncio
import httpx
import logging
import re
import time
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any, TypedDict, cast
from uuid import UUID, uuid4

from fastapi import HTTPException
from postgrest.exceptions import APIError
from redis.asyncio import Redis
from supabase import AsyncClient, acreate_client

from app.config import settings
from app.metrics import db_query_duration_seconds
from app.services.local_store import local_store

logger = logging.getLogger(__name__)

CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
CARBON_BASELINE_MODE = "car"
ROLE_PRIORITY = {"member": 1, "admin": 2, "owner": 3}
ALLOWED_TRANSPORT_TYPES = {"car", "bus", "bike", "remote", "train", "walk", "flight"}
EMISSION_FACTORS_G_PER_KM = {
    "walk": 0.0,
    "bike": 0.0,
    "train": 41.0,
    "metro": 45.0,
    "bus": 105.0,
    "carpool": 90.0,
    "ev": 60.0,
    "car": 192.0,
    "motorcycle": 103.0,
    "flight": 255.0,
    "remote": 0.0,
}
PERSONAL_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "mail.com",
    "gmx.com",
    "yandex.com",
    "abv.bg",
}


class UserRow(TypedDict):
    id: str
    email: str
    name: str
    initials: str
    color: str
    locale: str
    culture: str


class MessageRow(TypedDict):
    id: str
    channel_id: str
    user_id: str
    workspace_id: str
    text: str
    text_translated: str | None
    source_locale: str | None
    sentiment_score: float | None
    mesh_origin: bool
    deleted_at: str | None
    created_at: str
    updated_at: str


class WorkspaceMemberRow(TypedDict):
    workspace_id: str
    user_id: str
    role: str
    joined_at: str


class CarbonLogRow(TypedDict):
    id: str
    user_id: str
    workspace_id: str
    transport_type: str
    kg_co2: float
    logged_date: str
    logged_at: str


@dataclass(slots=True)
class WorkspaceMember:
    """Authoritative workspace membership view."""

    workspace_id: str
    user_id: str
    role: str


class DatabaseClient:
    """Encapsulates async Supabase operations for API and workers."""

    def __init__(self) -> None:
        self._client: AsyncClient | None = None
        self._admin_client: AsyncClient | None = None
        self._redis: Redis | None = None
        self._lock = asyncio.Lock()

    async def client(self) -> AsyncClient:
        """Return lazily initialized Supabase async client."""

        if self._client is not None:
            return self._client

        async with self._lock:
            if self._client is None:
                self._client = await acreate_client(settings.supabase_url, settings.supabase_api_key)
                logger.info("supabase_client_initialized")

        return self._client

    async def admin_client(self) -> AsyncClient | None:
        """Return Supabase service-role client for admin auth operations."""

        if not settings.supabase_service_key:
            return None

        # If main client already uses service role, reuse it.
        if settings.supabase_use_service_role:
            return await self.client()

        if self._admin_client is not None:
            return self._admin_client

        async with self._lock:
            if self._admin_client is None:
                self._admin_client = await acreate_client(
                    settings.supabase_url,
                    settings.supabase_service_key,
                )
                logger.info("supabase_admin_client_initialized")

        return self._admin_client

    async def auth_client(self) -> AsyncClient:
        """Return isolated anon-key Supabase client for auth flows.

        Auth methods can mutate client session state; using a short-lived client
        avoids leaking per-user auth context into shared database clients.
        """

        auth_key = settings.supabase_anon_key.strip() or settings.supabase_api_key
        return await acreate_client(settings.supabase_url, auth_key)

    async def _privileged_client(self) -> AsyncClient:
        """Return service-role client when available, else fallback client."""

        admin = await self.admin_client()
        if admin is not None:
            return admin
        return await self.client()

    async def cache(self) -> Redis:
        """Return shared Redis client used for membership caching."""

        if self._redis is not None:
            return self._redis

        async with self._lock:
            if self._redis is None:
                self._redis = Redis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                    max_connections=20,
                    socket_timeout=0.5,
                    socket_connect_timeout=0.5,
                )
        return self._redis

    @staticmethod
    def _sanitize_text(value: str, *, max_len: int = 2000) -> str:
        """Normalize user-provided text before storage."""

        clean = CONTROL_CHAR_PATTERN.sub("", value).strip()
        return clean[:max_len]

    @staticmethod
    def _sanitize_optional_text(value: str | None, *, max_len: int = 2000) -> str | None:
        """Normalize optional text values."""

        if value is None:
            return None
        return DatabaseClient._sanitize_text(value, max_len=max_len)

    @staticmethod
    def _initials_from_name(name: str) -> str:
        """Derive a short initials token for compatibility with legacy schema."""

        parts = [part for part in name.strip().split() if part]
        if not parts:
            return "??"
        if len(parts) == 1:
            return parts[0][:2].upper()
        return f"{parts[0][0]}{parts[-1][0]}".upper()

    @staticmethod
    def _extract_data(result: Any) -> Any:
        """Extract data payload from Supabase/PostgREST responses."""

        return getattr(result, "data", result)

    async def _execute(self, operation: str, query: Any) -> Any:
        """Execute query with duration metric collection."""

        started = time.perf_counter()
        try:
            return await query.execute()
        finally:
            db_query_duration_seconds.labels(operation=operation).observe(time.perf_counter() - started)

    @staticmethod
    def _http_500_db_error(exc: Exception) -> HTTPException:
        """Standardize database error surface for API callers."""

        logger.exception("database_operation_failed", extra={"error": str(exc)})
        return HTTPException(
            status_code=500,
            detail={"code": "db_error", "message": "Database operation failed."},
        )

    @staticmethod
    def _is_schema_missing_error(exc: Exception) -> bool:
        """Return True when PostgREST reports missing relation in schema cache."""

        if isinstance(exc, APIError):
            message = str(exc)
            return "PGRST205" in message or "schema cache" in message
        text = str(exc)
        return "PGRST205" in text or "schema cache" in text

    @staticmethod
    def _extract_email_domain(email: str) -> str | None:
        parts = email.strip().lower().split("@", 1)
        if len(parts) != 2 or not parts[1]:
            return None
        return parts[1]

    @staticmethod
    def _is_company_domain(domain: str | None) -> bool:
        if not domain:
            return False
        return "." in domain and domain not in PERSONAL_EMAIL_DOMAINS

    @staticmethod
    def _is_rate_limited_error(exc: Any) -> bool:
        text = str(exc).lower()
        return "429" in text or "too many requests" in text or "rate limit" in text

    @staticmethod
    def _is_email_exists_error(exc: Any) -> bool:
        text = str(exc).lower()
        return "already registered" in text or "already exists" in text or "email_exists" in text

    @staticmethod
    def _is_email_not_confirmed_error(exc: Any) -> bool:
        text = str(exc).lower()
        return "email not confirmed" in text or "email_not_confirmed" in text

    @staticmethod
    def _extract_auth_error_text(payload: Any) -> str:
        """Best-effort extraction of useful auth error text from SDK responses/exceptions."""

        candidates: list[str] = []

        def _push(value: Any) -> None:
            if value is None:
                return
            text = str(value).strip()
            if text and text not in candidates:
                candidates.append(text)

        if isinstance(payload, dict):
            for key in ("error", "message", "msg", "error_description", "details", "hint", "code"):
                _push(payload.get(key))
        else:
            for attr in ("error", "message", "msg", "error_description", "details", "hint", "code", "status"):
                _push(getattr(payload, attr, None))
            _push(payload)

        return " | ".join(candidates)

    @staticmethod
    def _extract_auth_status_code(payload: Any) -> int | None:
        """Best-effort extraction of auth status codes from SDK payloads."""

        values: list[Any] = []
        if isinstance(payload, dict):
            values.extend([payload.get("status"), payload.get("status_code"), payload.get("code")])
        else:
            values.extend([getattr(payload, "status", None), getattr(payload, "status_code", None), getattr(payload, "code", None)])

        for candidate in values:
            if candidate is None:
                continue
            text = str(candidate).strip()
            if text.isdigit():
                code = int(text)
                if 100 <= code <= 599:
                    return code
        return None

    @staticmethod
    def _is_users_email_conflict(exc: Exception) -> bool:
        """Return True when users table email unique constraint is violated."""

        parts = [str(exc).lower()]
        for attr in ("message", "details", "hint", "code"):
            value = getattr(exc, attr, None)
            if value:
                parts.append(str(value).lower())
        text = " ".join(parts)
        return (
            "users_email_key" in text
            or ("duplicate key" in text and "email" in text)
            or ("23505" in text and "email" in text)
        )

    @staticmethod
    async def _close_async_client_safely(client: Any) -> None:
        """Attempt to close ephemeral async clients without surfacing cleanup errors."""

        close_fn = getattr(client, "aclose", None)
        if callable(close_fn):
            with suppress(Exception):
                await close_fn()

    @staticmethod
    def _workspace_name_for_registration(*, display_name: str, company_name: str | None, email_domain: str | None) -> str:
        if company_name:
            return f"{company_name} Workspace"
        if email_domain and "." in email_domain:
            company_token = email_domain.split(".", 1)[0].replace("-", " ").strip()
            if company_token:
                return f"{company_token.title()} Workspace"
        return f"{display_name}'s Workspace"

    @staticmethod
    def _auth_user_field(user: Any, field: str) -> Any:
        """Read field from auth user object or dict payload."""

        if user is None:
            return None
        if isinstance(user, dict):
            return user.get(field)
        return getattr(user, field, None)

    async def _register_user_via_admin(
        self,
        *,
        email: str,
        password: str,
        display_name: str,
        company_name: str | None,
    ) -> Any:
        """Create a Supabase Auth user via admin API (service key)."""

        admin_client = await self.admin_client()
        if admin_client is None:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "too_many_requests",
                    "message": "Too many signup attempts right now. Please wait a minute and try again.",
                },
            )

        metadata: dict[str, str] = {"full_name": display_name}
        if company_name:
            metadata["company_name"] = company_name

        try:
            response = await admin_client.auth.admin.create_user(
                cast(
                    Any,
                    {
                        "email": email,
                        "password": password,
                        "email_confirm": True,
                        "user_metadata": metadata,
                    },
                )
            )
        except Exception as exc:
            if self._is_email_exists_error(exc):
                raise ValueError("email_already_exists") from exc
            if self._is_rate_limited_error(exc):
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "too_many_requests",
                        "message": "Too many signup attempts right now. Please wait a minute and try again.",
                    },
                ) from exc

            exc_text = self._extract_auth_error_text(exc).lower()
            if "password" in exc_text and ("weak" in exc_text or "least" in exc_text or "require" in exc_text):
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "weak_password",
                        "message": "Password does not meet security requirements.",
                    },
                ) from exc
            if "email" in exc_text and ("invalid" in exc_text or "malformed" in exc_text):
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "invalid_email",
                        "message": "Email address is invalid.",
                    },
                ) from exc

            if self._extract_auth_status_code(exc) == 422:
                raise ValueError("email_already_exists") from exc

            raise HTTPException(
                status_code=400,
                detail={
                    "code": "register_failed",
                    "message": "Unable to register user. Please verify email/password requirements and try again.",
                },
            ) from exc

        user = getattr(response, "user", None)
        if user is None and isinstance(response, dict):
            user = response.get("user")
        if user is None:
            response_error_text = self._extract_auth_error_text(response)
            response_error_lower = response_error_text.lower()
            response_status = self._extract_auth_status_code(response)

            logger.warning(
                "register_user_admin_create_missing_user",
                extra={
                    "email": email,
                    "status": response_status,
                    "error": response_error_text[:240],
                },
            )

            if self._is_email_exists_error(response_error_lower):
                raise ValueError("email_already_exists")
            if response_status == 422:
                raise ValueError("email_already_exists")
            if "password" in response_error_lower and (
                "weak" in response_error_lower or "least" in response_error_lower or "require" in response_error_lower
            ):
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "weak_password",
                        "message": "Password does not meet security requirements.",
                    },
                )
            if "email" in response_error_lower and ("invalid" in response_error_lower or "malformed" in response_error_lower):
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "invalid_email",
                        "message": "Email address is invalid.",
                    },
                )

            raise HTTPException(
                status_code=400,
                detail={
                    "code": "register_failed",
                    "message": "Unable to register user. Please verify email/password requirements and try again.",
                },
            )
        return user

    async def healthcheck(self) -> bool:
        """Run a minimal read query to confirm Supabase connectivity."""

        if settings.test_mode:
            return True

        client = await self.client()
        try:
            response = await self._execute("healthcheck", client.table("workspaces").select("id").limit(1))
            _ = self._extract_data(response)
            return True
        except Exception as exc:  # noqa: BLE001
            if self._is_schema_missing_error(exc):
                if settings.env.lower() == "production":
                    logger.error("supabase_healthcheck_schema_missing", extra={"error": str(exc)})
                    return False
                logger.warning("supabase_healthcheck_schema_missing", extra={"error": str(exc)})
                return True
            logger.warning("supabase_healthcheck_failed", extra={"error": str(exc)})
            return False

    async def register_user(
        self,
        *,
        email: str,
        password: str,
        name: str,
        company_name: str | None = None,
        locale: str | None = None,
    ) -> dict[str, Any]:
        """Create a new user and default workspace for login bootstrap flows."""

        normalized_email = self._sanitize_text(email.lower(), max_len=320)
        display_name = self._sanitize_text(name, max_len=120)
        safe_company_name = self._sanitize_optional_text(company_name, max_len=120)
        safe_locale = self._sanitize_text(locale or "en-US", max_len=16)
        email_domain = self._extract_email_domain(normalized_email)
        company_domain = email_domain if self._is_company_domain(email_domain) else None

        if settings.test_mode:
            return local_store.register_user(
                email=normalized_email,
                password=password,
                name=display_name,
                company_name=safe_company_name,
                locale=safe_locale,
            )

        auth_client = await self.auth_client()
        user: Any = None
        try:
            auth_response = await auth_client.auth.sign_up(
                {
                    "email": normalized_email,
                    "password": password,
                    "options": {
                        "data": {
                            "full_name": display_name,
                            **({"company_name": safe_company_name} if safe_company_name else {}),
                        }
                    },
                }
            )
            user = getattr(auth_response, "user", None)
            if user is None:
                # Some Supabase setups can return no user when signup is throttled/blocked.
                user = await self._register_user_via_admin(
                    email=normalized_email,
                    password=password,
                    display_name=display_name,
                    company_name=safe_company_name,
                )
            if user is None:
                if settings.auth_fallback_enabled:
                    logger.warning("register_user_supabase_missing_user_fallback", extra={"email": normalized_email})
                    return local_store.register_user(
                        email=normalized_email,
                        password=password,
                        name=display_name,
                        company_name=safe_company_name,
                        locale=safe_locale,
                    )
                raise HTTPException(status_code=400, detail={"code": "register_failed", "message": "Unable to register user."})
        except Exception as exc:
            handled_by_admin_fallback = False
            if self._is_rate_limited_error(exc):
                try:
                    user = await self._register_user_via_admin(
                        email=normalized_email,
                        password=password,
                        display_name=display_name,
                        company_name=safe_company_name,
                    )
                except ValueError:
                    raise
                except HTTPException as admin_exc:
                    admin_detail = admin_exc.detail if isinstance(admin_exc.detail, dict) else {}
                    admin_code = str(admin_detail.get("code", "")).lower()

                    if admin_code in {"email_already_exists", "user_already_exists", "email_exists"} or self._is_email_exists_error(admin_exc):
                        raise ValueError("email_already_exists") from admin_exc

                    if admin_code in {"weak_password", "invalid_email", "too_many_requests"}:
                        raise

                    # Supabase can create the user despite returning signup 429.
                    if admin_exc.status_code in (400, 422):
                        recovered = await self.authenticate_user(normalized_email, password)
                        recovered_user = recovered.get("user") if recovered else None
                        recovered_id = self._auth_user_field(recovered_user, "id")
                        if recovered_id:
                            user = recovered_user
                            handled_by_admin_fallback = True

                    if handled_by_admin_fallback:
                        pass
                    elif settings.auth_fallback_enabled:
                        logger.warning(
                            "register_user_rate_limited_fallback",
                            extra={"email": normalized_email, "error": str(exc)},
                        )
                        return local_store.register_user(
                            email=normalized_email,
                            password=password,
                            name=display_name,
                            company_name=safe_company_name,
                            locale=safe_locale,
                        )
                    elif admin_exc.status_code in (400, 422):
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "code": "email_already_exists",
                                "message": "An account with this email already exists. Try logging in or resetting your password.",
                            },
                        ) from admin_exc
                    else:
                        raise
                else:
                    # Admin fallback succeeded; continue with profile/workspace bootstrap.
                    handled_by_admin_fallback = True

            if not handled_by_admin_fallback:
                if self._is_email_exists_error(exc):
                    raise ValueError("email_already_exists") from exc
                if settings.auth_fallback_enabled:
                    logger.warning("register_user_supabase_fallback", extra={"email": normalized_email, "error": str(exc)})
                    return local_store.register_user(
                        email=normalized_email,
                        password=password,
                        name=display_name,
                        company_name=safe_company_name,
                        locale=safe_locale,
                    )
                raise
        finally:
            await self._close_async_client_safely(auth_client)

        if user is None:
            raise HTTPException(
                status_code=400,
                detail={"code": "register_failed", "message": "Unable to register user."},
            )

        user_id_value = self._auth_user_field(user, "id")
        user_email_value = self._auth_user_field(user, "email")
        if not user_id_value:
            raise HTTPException(
                status_code=400,
                detail={"code": "register_failed", "message": "Unable to register user."},
            )

        user_id = str(user_id_value)
        user_email = str(user_email_value or normalized_email)
        try:
            await self.upsert_user_profile(
                user_id=user_id,
                email=user_email,
                display_name=display_name,
                locale=safe_locale,
            )
        except Exception as exc:
            if self._is_users_email_conflict(exc):
                raise ValueError("email_already_exists") from exc
            raise

        await self.update_user_preferences(user_id=user_id, locale=safe_locale, coaching_enabled=None, accessibility_settings=None)

        write_client = await self._privileged_client()

        workspace_id = await self.get_default_workspace_for_user(user_id)
        if workspace_id is None:
            domain_workspace_id: str | None = None
            if company_domain:
                domain_workspace_id = await self.get_workspace_for_domain(company_domain)

            if domain_workspace_id:
                workspace_id = domain_workspace_id
                await self.add_workspace_member(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    role="member",
                )
            else:
                workspace_id = str(uuid4())
                now_iso = datetime.now(UTC).isoformat()
                workspace_name = self._workspace_name_for_registration(
                    display_name=display_name,
                    company_name=safe_company_name,
                    email_domain=company_domain,
                )
                await self._execute(
                    "register_create_workspace",
                    write_client.table("workspaces").insert(
                        {
                            "id": workspace_id,
                            "name": workspace_name,
                            "slug": f"ws-{workspace_id[:8]}",
                            "created_at": now_iso,
                        }
                    ),
                )
                await self.add_workspace_member(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    role="owner",
                )

                if company_domain:
                    await self.map_workspace_domain(
                        domain=company_domain,
                        workspace_id=workspace_id,
                    )

        return {
            "user": {
                "id": user_id,
                "email": user_email,
                "display_name": display_name,
            },
            "workspace_id": workspace_id,
        }

    async def get_workspace_for_domain(self, domain: str) -> str | None:
        """Resolve workspace id mapped to an email domain."""

        safe_domain = self._sanitize_text(domain.lower(), max_len=255)
        if settings.test_mode:
            return local_store.workspace_domains.get(safe_domain)

        client = await self._privileged_client()
        response = await self._execute(
            "get_workspace_for_domain",
            client.table("workspace_domains")
            .select("workspace_id")
            .eq("domain", safe_domain)
            .limit(1),
        )
        rows = self._extract_data(response) or []
        if not rows:
            if settings.auth_fallback_enabled:
                return local_store.workspace_domains.get(safe_domain)
            return None
        return str(rows[0]["workspace_id"])

    async def map_workspace_domain(self, *, domain: str, workspace_id: str) -> None:
        """Create or update domain-to-workspace mapping for onboarding."""

        safe_domain = self._sanitize_text(domain.lower(), max_len=255)
        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        if settings.test_mode:
            local_store.workspace_domains[safe_domain] = safe_workspace_id
            return

        client = await self._privileged_client()
        await self._execute(
            "map_workspace_domain",
            client.table("workspace_domains").upsert(
                cast(
                    Any,
                    {
                        "domain": safe_domain,
                        "workspace_id": safe_workspace_id,
                        "created_at": datetime.now(UTC).isoformat(),
                    },
                ),
                on_conflict="domain",
            ),
        )

    async def add_workspace_member(self, *, workspace_id: str, user_id: str, role: str) -> None:
        """Upsert workspace membership for a user."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        safe_user_id = self._sanitize_text(user_id, max_len=128)
        safe_role = self._sanitize_text(role.lower(), max_len=16)
        now_iso = datetime.now(UTC).isoformat()

        if settings.test_mode:
            existing = next(
                (
                    m
                    for m in local_store.workspace_members
                    if m["workspace_id"] == safe_workspace_id and m["user_id"] == safe_user_id
                ),
                None,
            )
            if existing is None:
                local_store.workspace_members.append(
                    {
                        "workspace_id": safe_workspace_id,
                        "user_id": safe_user_id,
                        "role": safe_role,
                        "joined_at": now_iso,
                    }
                )
            else:
                existing["role"] = safe_role
            return

        client = await self._privileged_client()
        await self._execute(
            "add_workspace_member",
            client.table("workspace_members").upsert(
                cast(
                    Any,
                    {
                        "workspace_id": safe_workspace_id,
                        "user_id": safe_user_id,
                        "role": safe_role,
                        "joined_at": now_iso,
                    },
                ),
                on_conflict="workspace_id,user_id",
            ),
        )

    async def list_user_organizations(self, *, user_id: str) -> list[dict[str, Any]]:
        """Return organizations where the user is a member."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode:
            memberships = [m for m in local_store.workspace_members if m.get("user_id") == safe_user_id]
            memberships.sort(key=lambda row: str(row.get("joined_at", "")))
            rows: list[dict[str, Any]] = []
            for member in memberships:
                workspace = local_store.workspaces.get(str(member.get("workspace_id")), {})
                rows.append(
                    {
                        "workspace_id": str(member.get("workspace_id", "")),
                        "role": str(member.get("role", "member")).lower(),
                        "joined_at": member.get("joined_at"),
                        "workspace": {
                            "id": workspace.get("id"),
                            "name": workspace.get("name"),
                            "slug": workspace.get("slug"),
                            "created_at": workspace.get("created_at"),
                        },
                    }
                )
            return rows

        client = await self._privileged_client()
        response = await self._execute(
            "list_user_organizations",
            client.table("workspace_members")
            .select("workspace_id,role,joined_at,workspaces(id,name,slug,created_at)")
            .eq("user_id", safe_user_id)
            .order("joined_at", desc=False),
        )
        rows = self._extract_data(response) or []
        normalized: list[dict[str, Any]] = []
        for row in rows:
            workspace = row.get("workspaces") if isinstance(row, dict) else None
            normalized.append(
                {
                    "workspace_id": str(row.get("workspace_id", "")),
                    "role": str(row.get("role", "member")).lower(),
                    "joined_at": row.get("joined_at"),
                    "workspace": {
                        "id": workspace.get("id") if isinstance(workspace, dict) else row.get("workspace_id"),
                        "name": workspace.get("name") if isinstance(workspace, dict) else None,
                        "slug": workspace.get("slug") if isinstance(workspace, dict) else None,
                        "created_at": workspace.get("created_at") if isinstance(workspace, dict) else None,
                    },
                }
            )
        return normalized

    async def list_workspace_members(self, *, workspace_id: str, online_window_minutes: int = 10) -> list[dict[str, Any]]:
        """Return members for a workspace with lightweight online status."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        now = datetime.now(UTC)
        cutoff = now - timedelta(minutes=max(1, min(int(online_window_minutes), 120)))

        if settings.test_mode:
            rows: list[dict[str, Any]] = []
            member_rows = [m for m in local_store.workspace_members if str(m.get("workspace_id", "")) == safe_workspace_id]

            activity_by_user: dict[str, str] = {}
            for message in local_store.messages.values():
                if str(message.get("workspace_id", "")) != safe_workspace_id:
                    continue
                user_id = str(message.get("user_id", ""))
                created_at = str(message.get("created_at", ""))
                if not user_id or not created_at:
                    continue
                previous = activity_by_user.get(user_id)
                if previous is None or created_at > previous:
                    activity_by_user[user_id] = created_at

            for member in member_rows:
                user_id = str(member.get("user_id", ""))
                user = local_store.users_by_id.get(user_id)
                last_activity_at = activity_by_user.get(user_id)
                is_online = False
                if last_activity_at:
                    try:
                        is_online = datetime.fromisoformat(last_activity_at.replace("Z", "+00:00")) >= cutoff
                    except ValueError:
                        is_online = False

                rows.append(
                    {
                        "user_id": user_id,
                        "display_name": user.display_name if user is not None else None,
                        "email": user.email if user is not None else None,
                        "avatar_url": user.avatar_url if user is not None else None,
                        "role": str(member.get("role", "member")).lower(),
                        "joined_at": member.get("joined_at"),
                        "is_online": is_online,
                        "last_activity_at": last_activity_at,
                    }
                )

            rows.sort(
                key=lambda row: (
                    0 if row.get("is_online") else 1,
                    str(row.get("display_name") or row.get("email") or "").lower(),
                )
            )
            return rows

        client = await self._privileged_client()
        members_response = await self._execute(
            "list_workspace_members",
            client.table("workspace_members")
            .select("workspace_id,user_id,role,joined_at,users(display_name,email,avatar_url)")
            .eq("workspace_id", safe_workspace_id)
            .order("joined_at", desc=False),
        )
        members = self._extract_data(members_response) or []

        channel_response = await self._execute(
            "list_workspace_members_channels",
            client.table("channels").select("id").eq("workspace_id", safe_workspace_id),
        )
        channel_rows = self._extract_data(channel_response) or []
        channel_ids = [str(row.get("id", "")) for row in channel_rows if row.get("id")]

        active_user_by_latest_timestamp: dict[str, str] = {}
        if channel_ids:
            activity_response = await self._execute(
                "list_workspace_members_activity",
                client.table("messages")
                .select("user_id,created_at")
                .in_("channel_id", channel_ids)
                .gte("created_at", cutoff.isoformat()),
            )
            for row in self._extract_data(activity_response) or []:
                user_id = str(row.get("user_id", ""))
                created_at = str(row.get("created_at", ""))
                if not user_id or not created_at:
                    continue
                previous = active_user_by_latest_timestamp.get(user_id)
                if previous is None or created_at > previous:
                    active_user_by_latest_timestamp[user_id] = created_at

        results: list[dict[str, Any]] = []
        for member in members:
            users_value = member.get("users") if isinstance(member, dict) else {}
            user_id = str(member.get("user_id", ""))
            last_activity_at = active_user_by_latest_timestamp.get(user_id)
            results.append(
                {
                    "user_id": user_id,
                    "display_name": users_value.get("display_name") if isinstance(users_value, dict) else None,
                    "email": users_value.get("email") if isinstance(users_value, dict) else None,
                    "avatar_url": users_value.get("avatar_url") if isinstance(users_value, dict) else None,
                    "role": str(member.get("role", "member")).lower(),
                    "joined_at": member.get("joined_at"),
                    "is_online": user_id in active_user_by_latest_timestamp,
                    "last_activity_at": last_activity_at,
                }
            )

        results.sort(
            key=lambda row: (
                0 if row.get("is_online") else 1,
                str(row.get("display_name") or row.get("email") or "").lower(),
            )
        )
        return results

    async def remove_workspace_member(self, *, workspace_id: str, member_user_id: str) -> dict[str, Any]:
        """Remove one member from workspace membership."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        safe_member_user_id = self._sanitize_text(member_user_id, max_len=128)

        if settings.test_mode:
            before_count = len(local_store.workspace_members)
            local_store.workspace_members = [
                row
                for row in local_store.workspace_members
                if not (
                    str(row.get("workspace_id", "")) == safe_workspace_id
                    and str(row.get("user_id", "")) == safe_member_user_id
                )
            ]
            removed = before_count != len(local_store.workspace_members)
            if not removed:
                raise HTTPException(status_code=404, detail={"code": "member_not_found", "message": "Member not found in workspace."})
            return {
                "workspace_id": safe_workspace_id,
                "member_user_id": safe_member_user_id,
                "removed": True,
            }

        client = await self._privileged_client()
        lookup = await self._execute(
            "remove_workspace_member_lookup",
            client.table("workspace_members")
            .select("workspace_id,user_id,role")
            .eq("workspace_id", safe_workspace_id)
            .eq("user_id", safe_member_user_id)
            .limit(1),
        )
        rows = self._extract_data(lookup) or []
        if not rows:
            raise HTTPException(status_code=404, detail={"code": "member_not_found", "message": "Member not found in workspace."})

        await self._execute(
            "remove_workspace_member",
            client.table("workspace_members")
            .delete()
            .eq("workspace_id", safe_workspace_id)
            .eq("user_id", safe_member_user_id),
        )

        return {
            "workspace_id": safe_workspace_id,
            "member_user_id": safe_member_user_id,
            "removed": True,
        }

    async def list_discoverable_organizations(
        self,
        *,
        user_id: str,
        search: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List organizations that the user is not yet a member of."""

        safe_search = self._sanitize_optional_text(search, max_len=120)
        memberships = await self.list_user_organizations(user_id=user_id)
        my_workspace_ids = {
            str(row.get("workspace_id", ""))
            for row in memberships
            if isinstance(row, dict)
        }

        if settings.test_mode:
            rows = []
            for workspace in local_store.workspaces.values():
                workspace_id = str(workspace.get("id", ""))
                if not workspace_id or workspace_id in my_workspace_ids:
                    continue
                if safe_search and safe_search.lower() not in str(workspace.get("name", "")).lower():
                    continue
                rows.append(
                    {
                        "id": workspace.get("id"),
                        "name": workspace.get("name"),
                        "slug": workspace.get("slug"),
                        "created_at": workspace.get("created_at"),
                    }
                )
            rows.sort(key=lambda item: str(item.get("name", "")).lower())
            return rows[: max(1, min(limit, 200))]

        client = await self._privileged_client()
        query = client.table("workspaces").select("id,name,slug,created_at").order("created_at", desc=False)
        if safe_search:
            query = query.ilike("name", f"%{safe_search}%")
        response = await self._execute("list_discoverable_organizations", query.limit(max(1, min(limit, 200))))
        rows = self._extract_data(response) or []
        return [
            row
            for row in rows
            if str(row.get("id", "")) not in my_workspace_ids
        ]

    async def create_organization(self, *, owner_user_id: str, name: str) -> dict[str, Any]:
        """Create a new organization and assign owner membership."""

        safe_owner_id = self._sanitize_text(owner_user_id, max_len=128)
        safe_name = self._sanitize_text(name, max_len=120)
        if not safe_name:
            raise HTTPException(status_code=422, detail={"code": "invalid_name", "message": "Organization name is required."})

        workspace_id = str(uuid4())
        now_iso = datetime.now(UTC).isoformat()
        payload = {
            "id": workspace_id,
            "name": safe_name,
            "slug": f"ws-{workspace_id[:8]}",
            "created_at": now_iso,
        }

        if settings.test_mode:
            local_store.workspaces[workspace_id] = payload
            await self.add_workspace_member(
                workspace_id=workspace_id,
                user_id=safe_owner_id,
                role="owner",
            )
            return payload

        client = await self._privileged_client()
        response = await self._execute("create_organization", client.table("workspaces").insert(payload))
        rows = self._extract_data(response) or []
        created = cast(dict[str, Any], rows[0]) if rows else payload
        await self.add_workspace_member(
            workspace_id=workspace_id,
            user_id=safe_owner_id,
            role="owner",
        )
        return created

    async def get_user_email(self, *, user_id: str) -> str | None:
        """Lookup canonical user email address from profile store."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode:
            user = local_store.users_by_id.get(safe_user_id)
            return user.email if user is not None else None

        client = await self._privileged_client()
        response = await self._execute(
            "get_user_email",
            client.table("users").select("email").eq("id", safe_user_id).limit(1),
        )
        rows = self._extract_data(response) or []
        if not rows:
            return None
        email = rows[0].get("email")
        return str(email).lower() if email else None

    async def resolve_user_email(self, *, user_id: str, fallback_email: str | None = None) -> str | None:
        """Resolve user email from profile, auth provider fallback, or trusted client fallback."""

        resolved = await self.get_user_email(user_id=user_id)
        if resolved:
            return resolved

        safe_user_id = self._sanitize_text(user_id, max_len=128)

        if not settings.test_mode:
            try:
                client = await self._privileged_client()
                response = await self._execute(
                    "resolve_user_email_auth_users",
                    client.table("auth.users").select("email").eq("id", safe_user_id).limit(1),
                )
                rows = self._extract_data(response) or []
                if rows:
                    email = rows[0].get("email")
                    if email:
                        return str(email).lower()
            except Exception:
                pass

        if fallback_email:
            safe_fallback = self._sanitize_text(fallback_email.lower(), max_len=320)
            if safe_fallback:
                return safe_fallback

        return None

    async def invite_user_by_email(
        self,
        *,
        workspace_id: str,
        invited_by_user_id: str,
        email: str,
        note: str | None = None,
    ) -> dict[str, Any]:
        """Invite a user email to join an organization."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        safe_inviter_id = self._sanitize_text(invited_by_user_id, max_len=128)
        safe_email = self._sanitize_text(email.lower(), max_len=320)
        safe_note = self._sanitize_optional_text(note, max_len=500)
        now_iso = datetime.now(UTC).isoformat()

        if settings.test_mode:
            invited_user = local_store.users_by_email.get(safe_email)
            if invited_user is not None:
                member = local_store.verify_workspace_access(
                    user_id=invited_user.id,
                    workspace_id=safe_workspace_id,
                    required_role=None,
                )
                if member is not None:
                    return {
                        "status": "already_member",
                        "workspace_id": safe_workspace_id,
                        "email": safe_email,
                    }

            existing = next(
                (
                    row
                    for row in local_store.workspace_invitations
                    if row.get("workspace_id") == safe_workspace_id and row.get("email") == safe_email
                ),
                None,
            )
            payload = {
                "id": str(uuid4()),
                "workspace_id": safe_workspace_id,
                "email": safe_email,
                "invited_user_id": invited_user.id if invited_user is not None else None,
                "invited_by_user_id": safe_inviter_id,
                "status": "pending",
                "note": safe_note,
                "created_at": now_iso,
                "responded_at": None,
            }
            if existing is None:
                local_store.workspace_invitations.append(payload)
                return payload
            existing.update(payload)
            existing["id"] = existing.get("id") or str(uuid4())
            return existing

        client = await self._privileged_client()

        invited_user_id: str | None = None
        user_lookup = await self._execute(
            "invite_lookup_user_by_email",
            client.table("users").select("id").eq("email", safe_email).limit(1),
        )
        user_rows = self._extract_data(user_lookup) or []
        if user_rows:
            invited_user_id = str(user_rows[0].get("id", ""))

        if invited_user_id:
            membership_lookup = await self._execute(
                "invite_lookup_existing_member",
                client.table("workspace_members")
                .select("workspace_id")
                .eq("workspace_id", safe_workspace_id)
                .eq("user_id", invited_user_id)
                .limit(1),
            )
            membership_rows = self._extract_data(membership_lookup) or []
            if membership_rows:
                return {
                    "status": "already_member",
                    "workspace_id": safe_workspace_id,
                    "email": safe_email,
                }

        payload = {
            "id": str(uuid4()),
            "workspace_id": safe_workspace_id,
            "email": safe_email,
            "invited_user_id": invited_user_id,
            "invited_by_user_id": safe_inviter_id,
            "status": "pending",
            "note": safe_note,
            "created_at": now_iso,
            "responded_at": None,
        }

        response = await self._execute(
            "invite_user_by_email",
            client.table("workspace_invitations").upsert(cast(Any, payload), on_conflict="workspace_id,email"),
        )
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else payload

    async def list_pending_invitations_for_user(self, *, user_id: str) -> list[dict[str, Any]]:
        """List pending organization invitations for the authenticated user."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        user_email = await self.get_user_email(user_id=safe_user_id)
        if not user_email:
            return []

        if settings.test_mode:
            rows = []
            for row in local_store.workspace_invitations:
                if row.get("status") != "pending":
                    continue
                if row.get("invited_user_id") != safe_user_id and str(row.get("email", "")).lower() != user_email:
                    continue
                workspace = local_store.workspaces.get(str(row.get("workspace_id")), {})
                rows.append(
                    {
                        "id": row.get("id"),
                        "workspace_id": row.get("workspace_id"),
                        "workspace_name": workspace.get("name"),
                        "workspace_slug": workspace.get("slug"),
                        "email": row.get("email"),
                        "status": row.get("status"),
                        "note": row.get("note"),
                        "created_at": row.get("created_at"),
                    }
                )
            rows.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
            return rows

        client = await self._privileged_client()

        by_user_response = await self._execute(
            "list_invitations_by_user",
            client.table("workspace_invitations")
            .select("id,workspace_id,email,status,note,created_at")
            .eq("status", "pending")
            .eq("invited_user_id", safe_user_id)
            .order("created_at", desc=True),
        )
        by_email_response = await self._execute(
            "list_invitations_by_email",
            client.table("workspace_invitations")
            .select("id,workspace_id,email,status,note,created_at")
            .eq("status", "pending")
            .eq("email", user_email)
            .order("created_at", desc=True),
        )

        deduped: dict[str, dict[str, Any]] = {}
        for row in (self._extract_data(by_user_response) or []) + (self._extract_data(by_email_response) or []):
            invitation_id = str(row.get("id", ""))
            if invitation_id:
                deduped[invitation_id] = cast(dict[str, Any], row)

        workspace_ids = {
            str(row.get("workspace_id", ""))
            for row in deduped.values()
            if row.get("workspace_id")
        }
        workspace_map: dict[str, dict[str, Any]] = {}
        if workspace_ids:
            workspace_response = await self._execute(
                "list_invitations_workspace_lookup",
                client.table("workspaces").select("id,name,slug").in_("id", list(workspace_ids)),
            )
            for workspace in self._extract_data(workspace_response) or []:
                workspace_map[str(workspace.get("id", ""))] = cast(dict[str, Any], workspace)

        rows = []
        for row in deduped.values():
            workspace = workspace_map.get(str(row.get("workspace_id", "")), {})
            rows.append(
                {
                    "id": row.get("id"),
                    "workspace_id": row.get("workspace_id"),
                    "workspace_name": workspace.get("name"),
                    "workspace_slug": workspace.get("slug"),
                    "email": row.get("email"),
                    "status": row.get("status"),
                    "note": row.get("note"),
                    "created_at": row.get("created_at"),
                }
            )
        rows.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
        return rows

    async def decide_invitation(
        self,
        *,
        invitation_id: str,
        user_id: str,
        decision: str,
    ) -> dict[str, Any]:
        """Accept or reject an invitation for the current user."""

        safe_invitation_id = self._sanitize_text(invitation_id, max_len=128)
        safe_user_id = self._sanitize_text(user_id, max_len=128)
        normalized_decision = self._sanitize_text(decision.lower(), max_len=16)
        if normalized_decision not in {"accept", "reject"}:
            raise HTTPException(status_code=422, detail={"code": "invalid_decision", "message": "Decision must be accept or reject."})

        user_email = await self.get_user_email(user_id=safe_user_id)
        if not user_email:
            raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User profile not found."})

        now_iso = datetime.now(UTC).isoformat()

        if settings.test_mode:
            row = next((r for r in local_store.workspace_invitations if str(r.get("id", "")) == safe_invitation_id), None)
            if row is None:
                raise HTTPException(status_code=404, detail={"code": "invitation_not_found", "message": "Invitation not found."})
            if str(row.get("status", "")).lower() != "pending":
                raise HTTPException(status_code=409, detail={"code": "invitation_not_pending", "message": "Invitation has already been decided."})

            invitation_email = str(row.get("email", "")).lower()
            invitation_user_id = str(row.get("invited_user_id", "") or "")
            if invitation_email != user_email and invitation_user_id != safe_user_id:
                raise HTTPException(status_code=403, detail={"code": "forbidden_invitation", "message": "Invitation does not belong to current user."})

            row["status"] = "accepted" if normalized_decision == "accept" else "rejected"
            row["responded_at"] = now_iso
            row["invited_user_id"] = safe_user_id
            if normalized_decision == "accept":
                await self.add_workspace_member(
                    workspace_id=str(row.get("workspace_id", "")),
                    user_id=safe_user_id,
                    role="member",
                )
            return row

        client = await self._privileged_client()
        lookup_response = await self._execute(
            "decide_invitation_lookup",
            client.table("workspace_invitations")
            .select("id,workspace_id,email,invited_user_id,status")
            .eq("id", safe_invitation_id)
            .limit(1),
        )
        rows = self._extract_data(lookup_response) or []
        if not rows:
            raise HTTPException(status_code=404, detail={"code": "invitation_not_found", "message": "Invitation not found."})

        row = cast(dict[str, Any], rows[0])
        if str(row.get("status", "")).lower() != "pending":
            raise HTTPException(status_code=409, detail={"code": "invitation_not_pending", "message": "Invitation has already been decided."})

        invitation_email = str(row.get("email", "")).lower()
        invitation_user_id = str(row.get("invited_user_id", "") or "")
        if invitation_email != user_email and invitation_user_id != safe_user_id:
            raise HTTPException(status_code=403, detail={"code": "forbidden_invitation", "message": "Invitation does not belong to current user."})

        status_value = "accepted" if normalized_decision == "accept" else "rejected"
        update_payload = {
            "status": status_value,
            "responded_at": now_iso,
            "invited_user_id": safe_user_id,
        }
        response = await self._execute(
            "decide_invitation_update",
            client.table("workspace_invitations")
            .update(cast(Any, update_payload))
            .eq("id", safe_invitation_id),
        )
        updated_rows = self._extract_data(response) or []
        updated = cast(dict[str, Any], updated_rows[0]) if updated_rows else {**row, **update_payload}

        if normalized_decision == "accept":
            await self.add_workspace_member(
                workspace_id=str(row.get("workspace_id", "")),
                user_id=safe_user_id,
                role="member",
            )
        return updated

    async def create_join_request(
        self,
        *,
        workspace_id: str,
        requester_user_id: str,
        message: str | None = None,
    ) -> dict[str, Any]:
        """Create or refresh a pending request to join an organization."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        safe_requester_id = self._sanitize_text(requester_user_id, max_len=128)
        safe_message = self._sanitize_optional_text(message, max_len=500)

        if await self.user_has_workspace_access(user_id=safe_requester_id, workspace_id=safe_workspace_id):
            raise HTTPException(status_code=409, detail={"code": "already_workspace_member", "message": "User is already a member of this organization."})

        now_iso = datetime.now(UTC).isoformat()

        if settings.test_mode:
            existing = next(
                (
                    row
                    for row in local_store.workspace_join_requests
                    if row.get("workspace_id") == safe_workspace_id and row.get("requester_user_id") == safe_requester_id
                ),
                None,
            )
            payload = {
                "id": str(uuid4()),
                "workspace_id": safe_workspace_id,
                "requester_user_id": safe_requester_id,
                "status": "pending",
                "message": safe_message,
                "reviewed_by_user_id": None,
                "created_at": now_iso,
                "reviewed_at": None,
            }
            if existing is None:
                local_store.workspace_join_requests.append(payload)
                return payload
            existing.update(payload)
            existing["id"] = existing.get("id") or str(uuid4())
            return existing

        client = await self._privileged_client()
        payload = {
            "id": str(uuid4()),
            "workspace_id": safe_workspace_id,
            "requester_user_id": safe_requester_id,
            "status": "pending",
            "message": safe_message,
            "reviewed_by_user_id": None,
            "created_at": now_iso,
            "reviewed_at": None,
        }
        response = await self._execute(
            "create_join_request",
            client.table("workspace_join_requests").upsert(
                cast(Any, payload),
                on_conflict="workspace_id,requester_user_id",
            ),
        )
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else payload

    async def list_workspace_join_requests(self, *, workspace_id: str) -> list[dict[str, Any]]:
        """List pending join requests for an organization."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)

        if settings.test_mode:
            rows = [
                row
                for row in local_store.workspace_join_requests
                if row.get("workspace_id") == safe_workspace_id and row.get("status") == "pending"
            ]
            rows.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
            enriched: list[dict[str, Any]] = []
            for row in rows:
                requester = local_store.users_by_id.get(str(row.get("requester_user_id", "")))
                enriched.append(
                    {
                        **row,
                        "requester_email": requester.email if requester else None,
                        "requester_display_name": requester.display_name if requester else None,
                    }
                )
            return enriched

        client = await self._privileged_client()
        response = await self._execute(
            "list_workspace_join_requests",
            client.table("workspace_join_requests")
            .select("id,workspace_id,requester_user_id,status,message,created_at,reviewed_at,reviewed_by_user_id")
            .eq("workspace_id", safe_workspace_id)
            .eq("status", "pending")
            .order("created_at", desc=True),
        )
        rows = self._extract_data(response) or []

        requester_ids = {
            str(row.get("requester_user_id", ""))
            for row in rows
            if row.get("requester_user_id")
        }
        requester_map: dict[str, dict[str, Any]] = {}
        if requester_ids:
            requester_response = await self._execute(
                "list_workspace_join_requests_users",
                client.table("users").select("id,email,display_name").in_("id", list(requester_ids)),
            )
            for user in self._extract_data(requester_response) or []:
                requester_map[str(user.get("id", ""))] = cast(dict[str, Any], user)

        enriched_rows: list[dict[str, Any]] = []
        for row in rows:
            requester = requester_map.get(str(row.get("requester_user_id", "")), {})
            enriched_rows.append(
                {
                    **row,
                    "requester_email": requester.get("email"),
                    "requester_display_name": requester.get("display_name"),
                }
            )
        return enriched_rows

    async def decide_join_request(
        self,
        *,
        join_request_id: str,
        reviewer_user_id: str,
        decision: str,
    ) -> dict[str, Any]:
        """Approve or reject an organization join request."""

        safe_request_id = self._sanitize_text(join_request_id, max_len=128)
        safe_reviewer_id = self._sanitize_text(reviewer_user_id, max_len=128)
        normalized_decision = self._sanitize_text(decision.lower(), max_len=16)
        if normalized_decision not in {"approve", "reject"}:
            raise HTTPException(status_code=422, detail={"code": "invalid_decision", "message": "Decision must be approve or reject."})

        now_iso = datetime.now(UTC).isoformat()

        if settings.test_mode:
            row = next((r for r in local_store.workspace_join_requests if str(r.get("id", "")) == safe_request_id), None)
            if row is None:
                raise HTTPException(status_code=404, detail={"code": "join_request_not_found", "message": "Join request not found."})
            if str(row.get("status", "")).lower() != "pending":
                raise HTTPException(status_code=409, detail={"code": "join_request_not_pending", "message": "Join request has already been reviewed."})

            await self.verify_workspace_access(
                user_id=UUID(safe_reviewer_id),
                workspace_id=UUID(str(row.get("workspace_id", ""))),
                required_role="admin",
            )

            next_status = "approved" if normalized_decision == "approve" else "rejected"
            row["status"] = next_status
            row["reviewed_by_user_id"] = safe_reviewer_id
            row["reviewed_at"] = now_iso

            if normalized_decision == "approve":
                await self.add_workspace_member(
                    workspace_id=str(row.get("workspace_id", "")),
                    user_id=str(row.get("requester_user_id", "")),
                    role="member",
                )
            return row

        client = await self._privileged_client()
        lookup_response = await self._execute(
            "decide_join_request_lookup",
            client.table("workspace_join_requests")
            .select("id,workspace_id,requester_user_id,status,message,created_at")
            .eq("id", safe_request_id)
            .limit(1),
        )
        rows = self._extract_data(lookup_response) or []
        if not rows:
            raise HTTPException(status_code=404, detail={"code": "join_request_not_found", "message": "Join request not found."})

        row = cast(dict[str, Any], rows[0])
        if str(row.get("status", "")).lower() != "pending":
            raise HTTPException(status_code=409, detail={"code": "join_request_not_pending", "message": "Join request has already been reviewed."})

        await self.verify_workspace_access(
            user_id=UUID(safe_reviewer_id),
            workspace_id=UUID(str(row.get("workspace_id", ""))),
            required_role="admin",
        )

        next_status = "approved" if normalized_decision == "approve" else "rejected"
        update_payload = {
            "status": next_status,
            "reviewed_by_user_id": safe_reviewer_id,
            "reviewed_at": now_iso,
        }
        response = await self._execute(
            "decide_join_request_update",
            client.table("workspace_join_requests")
            .update(cast(Any, update_payload))
            .eq("id", safe_request_id),
        )
        updated_rows = self._extract_data(response) or []
        updated = cast(dict[str, Any], updated_rows[0]) if updated_rows else {**row, **update_payload}

        if normalized_decision == "approve":
            await self.add_workspace_member(
                workspace_id=str(row.get("workspace_id", "")),
                user_id=str(row.get("requester_user_id", "")),
                role="member",
            )
        return updated

    async def authenticate_user(self, email: str, password: str) -> dict[str, Any] | None:
        """Authenticate with Supabase Auth and ensure profile exists."""

        if settings.test_mode:
            return local_store.authenticate_user(email=email, password=password)

        auth_client = await self.auth_client()
        normalized_email = self._sanitize_text(email.lower(), max_len=320)

        try:
            auth_response: Any | None = None
            for attempt in range(2):
                try:
                    auth_response = await auth_client.auth.sign_in_with_password(
                        {"email": normalized_email, "password": password}
                    )
                    break
                except Exception as exc:  # noqa: BLE001
                    logger.warning("auth_login_failed", extra={"email": normalized_email, "error": str(exc)})
                    if self._is_email_not_confirmed_error(exc):
                        can_auto_confirm = (not settings.auth_require_email_confirmation) and bool(settings.supabase_service_key)
                        if can_auto_confirm and attempt == 0:
                            confirmed = await self._confirm_user_email(normalized_email)
                            if confirmed:
                                continue
                        raise HTTPException(
                            status_code=403,
                            detail={
                                "code": "email_not_confirmed",
                                "message": "Email is not confirmed. Confirm your email before logging in.",
                            },
                        ) from exc
                    if self._is_rate_limited_error(exc):
                        raise HTTPException(
                            status_code=429,
                            detail={
                                "code": "too_many_requests",
                                "message": "Too many login attempts right now. Please wait a minute and try again.",
                            },
                        ) from exc
                    if settings.auth_fallback_enabled:
                        return local_store.authenticate_user(email=normalized_email, password=password)
                    return None

            if auth_response is None:
                return None
        finally:
            await self._close_async_client_safely(auth_client)

        user = getattr(auth_response, "user", None)
        session = getattr(auth_response, "session", None)
        if user is None:
            if settings.auth_fallback_enabled:
                return local_store.authenticate_user(email=normalized_email, password=password)
            return None

        display_name = user.user_metadata.get("full_name") if isinstance(getattr(user, "user_metadata", None), dict) else None
        try:
            await self.upsert_user_profile(
                user_id=user.id,
                email=user.email or normalized_email,
                display_name=display_name,
                locale="en-US",
            )
        except Exception as exc:
            if self._is_users_email_conflict(exc):
                logger.warning(
                    "auth_profile_email_conflict",
                    extra={"email": normalized_email, "user_id": user.id, "error": str(exc)},
                )
            else:
                raise

        return {
            "user": {"id": user.id, "email": user.email or normalized_email, "display_name": display_name},
            "supabase_access_token": getattr(session, "access_token", None),
        }

    async def _confirm_user_email(self, email: str) -> bool:
        """Confirm a Supabase auth user email via admin API when SMTP is unavailable."""

        service_key = (settings.supabase_service_key or "").strip()
        if not service_key:
            return False

        base_url = settings.supabase_url.rstrip("/")
        normalized_email = self._sanitize_text(email.lower(), max_len=320)
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                page = 1
                user_id: str | None = None

                while page <= 10 and user_id is None:
                    list_response = await client.get(
                        f"{base_url}/auth/v1/admin/users",
                        headers=headers,
                        params={"page": page, "per_page": 200},
                    )
                    if list_response.status_code >= 400:
                        logger.warning(
                            "auth_auto_confirm_list_failed",
                            extra={"email": normalized_email, "status": list_response.status_code},
                        )
                        return False

                    payload = list_response.json()
                    users = payload.get("users") if isinstance(payload, dict) else None
                    if not isinstance(users, list) or not users:
                        break

                    for item in users:
                        if not isinstance(item, dict):
                            continue
                        item_email = str(item.get("email") or "").strip().lower()
                        if item_email != normalized_email:
                            continue
                        candidate_id = str(item.get("id") or "").strip()
                        if candidate_id:
                            user_id = candidate_id
                            break

                    if len(users) < 200:
                        break
                    page += 1

                if not user_id:
                    return False

                update_response = await client.put(
                    f"{base_url}/auth/v1/admin/users/{user_id}",
                    headers=headers,
                    json={"email_confirm": True},
                )
                if update_response.status_code >= 400:
                    logger.warning(
                        "auth_auto_confirm_update_failed",
                        extra={"email": normalized_email, "status": update_response.status_code},
                    )
                    return False
        except Exception as exc:  # noqa: BLE001
            logger.warning("auth_auto_confirm_failed", extra={"email": normalized_email, "error": str(exc)})
            return False

        logger.info("auth_auto_confirmed", extra={"email": normalized_email})
        return True

    async def send_magic_link(self, email: str) -> None:
        """Send a Supabase magic-link login email."""

        if settings.test_mode:
            return

        client = await self.auth_client()
        normalized_email = self._sanitize_text(email.lower(), max_len=320)
        try:
            await client.auth.sign_in_with_otp({"email": normalized_email})
        finally:
            await self._close_async_client_safely(client)

    async def upsert_user_profile(
        self,
        *,
        user_id: str,
        email: str,
        display_name: str | None,
        locale: str,
        coaching_enabled: bool = True,
        accessibility_settings: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Insert or update the users table row."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        safe_email = self._sanitize_text(email.lower(), max_len=320)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            user = local_store.users_by_id.get(user_id)
            if user is None:
                local_store.register_user(
                    email=safe_email,
                    password=sha256(uuid4().hex.encode("utf-8")).hexdigest(),
                    name=display_name or email.split("@", 1)[0],
                )
                user = local_store.users_by_email[safe_email]
            user.display_name = display_name or user.display_name
            user.locale = locale
            user.coaching_enabled = bool(coaching_enabled)
            user.accessibility_settings = accessibility_settings or {}
            return {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "locale": user.locale,
                "coaching_enabled": user.coaching_enabled,
                "accessibility_settings": user.accessibility_settings,
            }

        client = await self._privileged_client()
        resolved_name = self._sanitize_text(
            (display_name or safe_email.split("@", 1)[0]),
            max_len=120,
        )
        payload = {
            "id": self._sanitize_text(user_id, max_len=128),
            "email": self._sanitize_text(email.lower(), max_len=320),
            "name": resolved_name,
            "initials": self._initials_from_name(resolved_name),
            "display_name": self._sanitize_optional_text(display_name, max_len=120),
            "locale": self._sanitize_text(locale, max_len=16),
            "coaching_opt_in": bool(coaching_enabled),
            "accessibility_prefs": accessibility_settings or {},
            "coaching_enabled": bool(coaching_enabled),
            "accessibility_settings": accessibility_settings or {},
            "updated_at": datetime.now(UTC).isoformat(),
        }

        try:
            response = await self._execute("upsert_user_profile", client.table("users").upsert(payload, on_conflict="id"))
        except APIError as exc:
            if "42501" in str(exc):
                logger.warning(
                    "upsert_user_profile_rls_denied",
                    extra={"user_id": safe_user_id, "email": safe_email, "error": str(exc)},
                )
                return payload
            raise
        data = self._extract_data(response) or []
        return data[0] if data else payload

    async def get_user_profile(self, user_id: str) -> dict[str, Any] | None:
        """Fetch the current user's full profile."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            return local_store.get_user_profile(safe_user_id)

        client = await self.client()
        response = await self._execute(
            "get_user_profile",
            client.table("users")
            .select("id,email,username,display_name,bio,timezone,locale,role,avatar_url")
            .eq("id", safe_user_id)
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else None

    async def update_user_profile(
        self,
        user_id: str,
        *,
        display_name: str | None,
        bio: str | None,
        timezone: str | None,
        avatar_url: str | None,
    ) -> dict[str, Any] | None:
        """Patch mutable user profile fields and return the updated row."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            return local_store.update_user_profile(
                safe_user_id,
                display_name=display_name,
                bio=bio,
                timezone=timezone,
                avatar_url=avatar_url,
            )

        client = await self.client()
        payload: dict[str, Any] = {"updated_at": datetime.now(UTC).isoformat()}
        if display_name is not None:
            normalized_display_name = self._sanitize_text(display_name, max_len=64)
            payload["display_name"] = normalized_display_name
            # Keep legacy profile columns in sync with display_name updates.
            payload["name"] = self._sanitize_text(normalized_display_name, max_len=120)
            payload["initials"] = self._initials_from_name(normalized_display_name)
        if bio is not None:
            payload["bio"] = self._sanitize_optional_text(bio, max_len=500)
        if timezone is not None:
            payload["timezone"] = self._sanitize_text(timezone, max_len=64) if timezone else None
        if avatar_url is not None:
            payload["avatar_url"] = self._sanitize_optional_text(avatar_url, max_len=1_000_000)

        try:
            await self._execute(
                "update_user_profile",
                client.table("users").update(payload).eq("id", safe_user_id),
            )
        except APIError as exc:
            error_text = str(exc).lower()
            # Backward compatibility for environments where users.avatar_url is not present yet.
            if "avatar_url" in payload and ("column" in error_text and "avatar_url" in error_text):
                payload.pop("avatar_url", None)
                await self._execute(
                    "update_user_profile_without_avatar",
                    client.table("users").update(payload).eq("id", safe_user_id),
                )
            else:
                raise
        return await self.get_user_profile(user_id)

    async def get_user_preferences(self, user_id: str) -> dict[str, Any]:
        """Fetch user preferences by user id."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            if user_id in local_store.users_by_id:
                return local_store.get_user_preferences(user_id=user_id)
            return {"locale": "en-US", "coaching_enabled": True, "accessibility_settings": {}}

        client = await self.client()
        response = await self._execute(
            "get_user_preferences",
            client.table("users")
            .select("locale,coaching_enabled,accessibility_settings")
            .eq("id", self._sanitize_text(user_id, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        if not rows:
            return {"locale": "en-US", "coaching_enabled": True, "accessibility_settings": {}}
        return cast(dict[str, Any], rows[0])

    async def update_user_preferences(
        self,
        user_id: str,
        *,
        locale: str | None,
        coaching_enabled: bool | None,
        accessibility_settings: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Patch user preference values and return latest row."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            return local_store.upsert_user_preferences(
                user_id=safe_user_id,
                locale=locale,
                coaching_enabled=coaching_enabled,
                accessibility_settings=accessibility_settings,
            )

        client = await self.client()
        payload: dict[str, Any] = {"updated_at": datetime.now(UTC).isoformat()}
        if locale is not None:
            payload["locale"] = self._sanitize_text(locale, max_len=16)
        if coaching_enabled is not None:
            payload["coaching_enabled"] = bool(coaching_enabled)
        if accessibility_settings is not None:
            payload["accessibility_settings"] = accessibility_settings

        await self._execute(
            "update_user_preferences",
            client.table("users").update(payload).eq("id", self._sanitize_text(user_id, max_len=128)),
        )
        return await self.get_user_preferences(user_id)

    async def get_default_workspace_for_user(self, user_id: str) -> str | None:
        """Return deterministic default workspace for login token claims."""

        if settings.test_mode:
            return local_store.get_default_workspace_for_user(user_id)

        client = await self._privileged_client()
        response = await self._execute(
            "get_default_workspace_for_user",
            client.table("workspace_members")
            .select("workspace_id")
            .eq("user_id", self._sanitize_text(user_id, max_len=128))
            .order("joined_at", desc=False)
            .limit(1),
        )
        rows = self._extract_data(response) or []
        if not rows:
            if settings.auth_fallback_enabled:
                return local_store.get_default_workspace_for_user(user_id)
            return None
        return str(rows[0]["workspace_id"])

    async def ensure_default_workspace_for_user(
        self,
        *,
        user_id: str,
        display_name: str | None = None,
        email: str | None = None,
    ) -> str | None:
        """Ensure a user has a default workspace, creating one when missing."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        existing_workspace = await self.get_default_workspace_for_user(safe_user_id)
        if existing_workspace is not None:
            return existing_workspace

        safe_display_name = self._sanitize_optional_text(display_name, max_len=120)
        if safe_display_name is None and email:
            local_part = email.strip().split("@", 1)[0]
            safe_display_name = self._sanitize_text(local_part, max_len=120)
        owner_name = safe_display_name or "User"

        workspace_id = str(uuid4())
        now_iso = datetime.now(UTC).isoformat()
        workspace_payload = {
            "id": workspace_id,
            "name": f"{owner_name}'s Workspace",
            "slug": f"ws-{workspace_id[:8]}",
            "created_at": now_iso,
        }

        if settings.test_mode:
            local_store.workspaces[workspace_id] = workspace_payload
            local_store.workspace_members.append(
                {
                    "workspace_id": workspace_id,
                    "user_id": safe_user_id,
                    "role": "owner",
                    "joined_at": now_iso,
                }
            )
            return workspace_id

        client = await self._privileged_client()
        try:
            await self._execute(
                "bootstrap_create_workspace",
                client.table("workspaces").insert(workspace_payload),
            )
            await self._execute(
                "bootstrap_create_membership",
                client.table("workspace_members").insert(
                    {
                        "workspace_id": workspace_id,
                        "user_id": safe_user_id,
                        "role": "owner",
                        "joined_at": now_iso,
                    }
                ),
            )
            return workspace_id
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "ensure_default_workspace_failed",
                extra={"user_id": safe_user_id, "error": str(exc)},
            )
            # Handle race conditions where another request created membership first.
            return await self.get_default_workspace_for_user(safe_user_id)

    async def create_refresh_token(
        self,
        *,
        user_id: str,
        token_hash: str,
        workspace_id: str,
        expires_at: datetime,
        device_hint: str | None,
    ) -> dict[str, Any]:
        """Insert refresh token metadata row."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            return local_store.create_refresh_token(
                user_id=safe_user_id,
                token_hash=self._sanitize_text(token_hash, max_len=128),
                workspace_id=self._sanitize_text(workspace_id, max_len=128),
                expires_at_iso=expires_at.astimezone(UTC).isoformat(),
                device_hint=self._sanitize_optional_text(device_hint, max_len=64),
            )

        client = await self._privileged_client()
        payload: dict[str, Any] = {
            "id": str(uuid4()),
            "user_id": self._sanitize_text(user_id, max_len=128),
            "token_hash": self._sanitize_text(token_hash, max_len=128),
            "workspace_id": self._sanitize_text(workspace_id, max_len=128),
            "issued_at": datetime.now(UTC).isoformat(),
            "expires_at": expires_at.astimezone(UTC).isoformat(),
            "revoked": False,
            "revoked_at": None,
            "device_hint": self._sanitize_optional_text(device_hint, max_len=64),
        }
        response = await self._execute("create_refresh_token", client.table("refresh_tokens").insert(cast(Any, payload)))
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else payload

    async def get_refresh_token_by_hash(self, token_hash: str) -> dict[str, Any] | None:
        """Load refresh token row by hashed token value."""

        safe_hash = self._sanitize_text(token_hash, max_len=128)
        if settings.test_mode:
            return local_store.get_refresh_token(safe_hash)
        if settings.auth_fallback_enabled:
            local_row = local_store.get_refresh_token(safe_hash)
            if local_row is not None:
                return local_row

        client = await self._privileged_client()
        response = await self._execute(
            "get_refresh_token_by_hash",
            client.table("refresh_tokens")
            .select("id,user_id,workspace_id,token_hash,issued_at,expires_at,revoked,revoked_at,device_hint")
            .eq("token_hash", self._sanitize_text(token_hash, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def revoke_refresh_token(self, token_hash: str) -> None:
        """Revoke one refresh token hash immediately."""

        safe_hash = self._sanitize_text(token_hash, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and local_store.get_refresh_token(safe_hash) is not None):
            local_store.revoke_refresh_token(safe_hash)
            return

        client = await self._privileged_client()
        await self._execute(
            "revoke_refresh_token",
            client.table("refresh_tokens")
            .update({"revoked": True, "revoked_at": datetime.now(UTC).isoformat()})
            .eq("token_hash", self._sanitize_text(token_hash, max_len=128)),
        )

    async def revoke_all_refresh_tokens_for_user(self, user_id: str) -> None:
        """Revoke all refresh tokens for one user (reuse detection response)."""

        safe_user_id = self._sanitize_text(user_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_user_id in local_store.users_by_id):
            local_store.revoke_all_refresh_tokens_for_user(safe_user_id)
            return

        client = await self._privileged_client()
        await self._execute(
            "revoke_all_refresh_tokens_for_user",
            client.table("refresh_tokens")
            .update({"revoked": True, "revoked_at": datetime.now(UTC).isoformat()})
            .eq("user_id", self._sanitize_text(user_id, max_len=128))
            .eq("revoked", False),
        )

    async def rotate_refresh_token(
        self,
        *,
        old_token_hash: str,
        new_token_hash: str,
        user_id: str,
        workspace_id: str,
        expires_at: datetime,
        device_hint: str | None,
    ) -> bool:
        """Atomically rotate refresh token via RPC; fallback to guarded sequence."""

        safe_old_hash = self._sanitize_text(old_token_hash, max_len=128)
        safe_new_hash = self._sanitize_text(new_token_hash, max_len=128)
        safe_user_id = self._sanitize_text(user_id, max_len=128)
        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and local_store.get_refresh_token(safe_old_hash) is not None):
            return local_store.rotate_refresh_token(
                old_token_hash=safe_old_hash,
                new_token_hash=safe_new_hash,
                user_id=safe_user_id,
                workspace_id=safe_workspace_id,
                expires_at_iso=expires_at.astimezone(UTC).isoformat(),
                device_hint=self._sanitize_optional_text(device_hint, max_len=64),
            )

        client = await self._privileged_client()
        params = {
            "p_old_token_hash": self._sanitize_text(old_token_hash, max_len=128),
            "p_new_token_hash": self._sanitize_text(new_token_hash, max_len=128),
            "p_user_id": self._sanitize_text(user_id, max_len=128),
            "p_workspace_id": self._sanitize_text(workspace_id, max_len=128),
            "p_expires_at": expires_at.astimezone(UTC).isoformat(),
            "p_device_hint": self._sanitize_optional_text(device_hint, max_len=64),
        }

        try:
            response = await self._execute("rotate_refresh_token_rpc", client.rpc("rotate_refresh_token", params))
            data = self._extract_data(response)
            if isinstance(data, bool):
                return data
            if isinstance(data, list) and data:
                return bool(data[0])
            return bool(data)
        except Exception:
            try:
                existing = await self.get_refresh_token_by_hash(old_token_hash)
                if existing is None or bool(existing.get("revoked")):
                    return False
                await self.revoke_refresh_token(old_token_hash)
                await self.create_refresh_token(
                    user_id=user_id,
                    token_hash=new_token_hash,
                    workspace_id=workspace_id,
                    expires_at=expires_at,
                    device_hint=device_hint,
                )
                return True
            except Exception:
                return False

    async def verify_workspace_access(
        self,
        user_id: UUID,
        workspace_id: UUID,
        required_role: str | None = None,
    ) -> WorkspaceMember:
        """Verify membership from authoritative workspace_members table."""

        safe_user = str(user_id)
        safe_workspace = str(workspace_id)

        if (settings.test_mode or settings.auth_fallback_enabled) and safe_workspace in local_store.workspaces:
            if safe_workspace not in local_store.workspaces:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "workspace_not_found", "message": "Workspace does not exist."},
                )
            member = local_store.verify_workspace_access(
                user_id=safe_user,
                workspace_id=safe_workspace,
                required_role=required_role,
            )
            if member is None:
                raise HTTPException(
                    status_code=403,
                    detail={"code": "not_workspace_member", "message": "User is not a workspace member."},
                )
            return WorkspaceMember(
                workspace_id=str(member["workspace_id"]),
                user_id=str(member["user_id"]),
                role=str(member["role"]),
            )

        cache_key = f"workspace_member:{safe_workspace}:{safe_user}"

        try:
            cache = await self.cache()
            cached = await cache.get(cache_key)
            if cached:
                role = cached.strip().lower()
                member = WorkspaceMember(workspace_id=safe_workspace, user_id=safe_user, role=role)
                self._assert_role(member, required_role)
                return member
        except Exception as exc:  # noqa: BLE001
            logger.warning("workspace_member_cache_read_failed", extra={"error": str(exc)})

        client = await self.client()
        try:
            workspace_response = await self._execute(
                "verify_workspace_exists",
                client.table("workspaces").select("id").eq("id", safe_workspace).limit(1),
            )
            workspace_rows = self._extract_data(workspace_response) or []
            if not workspace_rows:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "workspace_not_found", "message": "Workspace does not exist."},
                )

            response = await self._execute(
                "verify_workspace_access",
                client.table("workspace_members")
                .select("workspace_id,user_id,role")
                .eq("workspace_id", safe_workspace)
                .eq("user_id", safe_user)
                .limit(1),
            )
            rows = self._extract_data(response) or []
            if not rows:
                raise HTTPException(
                    status_code=403,
                    detail={"code": "not_workspace_member", "message": "User is not a workspace member."},
                )

            row = rows[0]
            member = WorkspaceMember(
                workspace_id=str(row["workspace_id"]),
                user_id=str(row["user_id"]),
                role=str(row.get("role", "member")).lower(),
            )
            self._assert_role(member, required_role)

            try:
                cache = await self.cache()
                await cache.set(cache_key, member.role, ex=60)
            except Exception as exc:  # noqa: BLE001
                logger.warning("workspace_member_cache_write_failed", extra={"error": str(exc)})

            return member
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise self._http_500_db_error(exc) from exc

    @staticmethod
    def _assert_role(member: WorkspaceMember, required_role: str | None) -> None:
        """Validate member role satisfies required hierarchy."""

        if required_role is None:
            return

        required = required_role.strip().lower()
        current = member.role.strip().lower()
        if ROLE_PRIORITY.get(current, 0) < ROLE_PRIORITY.get(required, 0):
            raise HTTPException(
                status_code=403,
                detail={"code": "insufficient_role", "message": "Workspace role is insufficient for this action."},
            )

    async def user_has_workspace_access(self, *, user_id: str, workspace_id: str) -> bool:
        """Backward-compatible boolean gate for legacy call sites."""

        try:
            await self.verify_workspace_access(UUID(user_id), UUID(workspace_id))
            return True
        except Exception:
            return False

    async def list_channels(self, workspace_id: str) -> list[dict[str, Any]]:
        """List channels for a workspace sorted by creation date."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_workspace_id in local_store.workspaces):
            return local_store.list_channels(safe_workspace_id)

        client = await self.client()
        response = await self._execute(
            "list_channels",
            client.table("channels")
            .select("id,workspace_id,name,description,tone,is_private,created_by,created_at")
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .order("created_at", desc=False),
        )
        return self._extract_data(response) or []

    async def create_channel(
        self,
        *,
        workspace_id: str,
        name: str,
        description: str | None,
        tone: str,
        created_by: str,
        is_private: bool = False,
    ) -> dict[str, Any]:
        """Create a new channel and return the created record."""

        safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and safe_workspace_id in local_store.workspaces):
            return local_store.create_channel(
                workspace_id=safe_workspace_id,
                name=self._sanitize_text(name, max_len=settings.max_channel_name_length),
                description=self._sanitize_optional_text(description, max_len=500),
                tone=self._sanitize_text(tone, max_len=64),
                created_by=self._sanitize_text(created_by, max_len=128),
                is_private=bool(is_private),
            )

        client = await self.client()
        payload = {
            "id": str(uuid4()),
            "workspace_id": self._sanitize_text(workspace_id, max_len=128),
            "name": self._sanitize_text(name, max_len=settings.max_channel_name_length),
            "description": self._sanitize_optional_text(description, max_len=500),
            "tone": self._sanitize_text(tone, max_len=64),
            "is_private": bool(is_private),
            "created_by": self._sanitize_text(created_by, max_len=128),
            "created_at": datetime.now(UTC).isoformat(),
        }
        response = await self._execute("create_channel", client.table("channels").insert(payload))
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_channel(self, channel_id: str) -> dict[str, Any] | None:
        """Fetch channel row by id."""

        safe_channel_id = self._sanitize_text(channel_id, max_len=128)
        if settings.test_mode:
            return local_store.get_channel(safe_channel_id)
        if settings.auth_fallback_enabled:
            local_channel = local_store.get_channel(safe_channel_id)
            if local_channel is not None:
                return local_channel

        client = await self.client()
        response = await self._execute(
            "get_channel",
            client.table("channels")
            .select("id,workspace_id,name,tone,created_by")
            .eq("id", self._sanitize_text(channel_id, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def update_channel(
        self,
        *,
        channel_id: str,
        name: str | None = None,
        description: str | None = None,
        tone: str | None = None,
        is_private: bool | None = None,
    ) -> dict[str, Any] | None:
        """Update mutable channel fields and return updated channel."""

        safe_channel_id = self._sanitize_text(channel_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and local_store.get_channel(safe_channel_id) is not None):
            return local_store.update_channel(
                channel_id=safe_channel_id,
                name=self._sanitize_optional_text(name, max_len=settings.max_channel_name_length),
                description=self._sanitize_optional_text(description, max_len=500),
                tone=self._sanitize_optional_text(tone, max_len=64),
                is_private=is_private,
            )

        patch: dict[str, Any] = {}
        if isinstance(name, str) and name.strip():
            patch["name"] = self._sanitize_text(name, max_len=settings.max_channel_name_length)
        if description is not None:
            patch["description"] = self._sanitize_optional_text(description, max_len=500)
        if isinstance(tone, str) and tone.strip():
            patch["tone"] = self._sanitize_text(tone, max_len=64)
        if is_private is not None:
            patch["is_private"] = bool(is_private)

        if not patch:
            return await self.get_channel(safe_channel_id)

        client = await self.client()
        response = await self._execute(
            "update_channel",
            client.table("channels")
            .update(patch)
            .eq("id", safe_channel_id)
            .select("id,workspace_id,name,description,tone,is_private,created_by,created_at")
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def delete_channel(self, channel_id: str) -> bool:
        """Delete channel by id."""

        safe_channel_id = self._sanitize_text(channel_id, max_len=128)
        if settings.test_mode or (settings.auth_fallback_enabled and local_store.get_channel(safe_channel_id) is not None):
            return local_store.delete_channel(safe_channel_id)

        client = await self.client()
        response = await self._execute(
            "delete_channel",
            client.table("channels")
            .delete()
            .eq("id", safe_channel_id)
            .select("id")
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return bool(rows)

    async def list_messages(
        self,
        *,
        channel_id: str,
        cursor: str | None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> dict[str, Any]:
        """Return cursor-paginated channel messages using message UUID cursor."""

        if settings.test_mode:
            safe_limit = max(1, min(limit, MAX_PAGE_SIZE))
            rows = [
                row
                for row in local_store.messages.values()
                if row.get("channel_id") == self._sanitize_text(channel_id, max_len=128)
            ]
            rows.sort(key=lambda row: (str(row.get("created_at", "")), str(row.get("id", ""))))

            if cursor:
                cursor_row = local_store.messages.get(self._sanitize_text(cursor, max_len=128))
                if cursor_row is not None:
                    cursor_created = str(cursor_row.get("created_at", ""))
                    cursor_id = str(cursor_row.get("id", ""))
                    rows = [
                        row
                        for row in rows
                        if (
                            str(row.get("created_at", "")) > cursor_created
                            or (
                                str(row.get("created_at", "")) == cursor_created
                                and str(row.get("id", "")) > cursor_id
                            )
                        )
                    ]

            next_cursor: str | None = None
            if len(rows) > safe_limit:
                next_cursor = str(rows[safe_limit - 1]["id"])
                rows = rows[:safe_limit]

            normalized = []
            for row in rows:
                copy_row = dict(row)
                if copy_row.get("deleted_at") is not None:
                    copy_row["text"] = "[deleted]"
                normalized.append(copy_row)
            return {"messages": normalized, "next_cursor": next_cursor}

        client = await self.client()
        safe_limit = max(1, min(limit, MAX_PAGE_SIZE))

        query = (
            client.table("messages")
            .select("id,channel_id,user_id,text,translated,sentiment_score,mesh_origin,created_at,deleted_at")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .order("created_at", desc=False)
            .order("id", desc=False)
            .limit(safe_limit + 1)
        )

        if cursor:
            cursor_response = await self._execute(
                "list_messages_cursor_lookup",
                client.table("messages")
                .select("id,created_at")
                .eq("id", self._sanitize_text(cursor, max_len=128))
                .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
                .limit(1),
            )
            cursor_rows = self._extract_data(cursor_response) or []
            if cursor_rows:
                cursor_row = cursor_rows[0]
                query = query.or_(
                    "created_at.gt.{created},and(created_at.eq.{created},id.gt.{id})".format(
                        created=cursor_row["created_at"],
                        id=cursor_row["id"],
                    )
                )

        response = await self._execute("list_messages", query)
        rows = self._extract_data(response) or []

        next_cursor: str | None = None
        if len(rows) > safe_limit:
            next_cursor = rows[safe_limit - 1]["id"]
            rows = rows[:safe_limit]

        for row in rows:
            if row.get("deleted_at") is not None:
                row["text"] = "[deleted]"

        return {"messages": rows, "next_cursor": next_cursor}

    async def create_message(
        self,
        *,
        channel_id: str,
        user_id: str,
        text: str,
        translated: str | None = None,
        sentiment_score: float = 0.0,
        mesh_origin: bool = False,
    ) -> dict[str, Any]:
        """Persist a message row."""

        if settings.test_mode:
            return local_store.create_message(
                channel_id=self._sanitize_text(channel_id, max_len=128),
                user_id=self._sanitize_text(user_id, max_len=128),
                workspace_id=self._sanitize_text(
                    str(local_store.get_channel(self._sanitize_text(channel_id, max_len=128)).get("workspace_id", ""))
                    if local_store.get_channel(self._sanitize_text(channel_id, max_len=128))
                    else "",
                    max_len=128,
                ),
                text=self._sanitize_text(text, max_len=settings.max_message_length),
                mesh_origin=bool(mesh_origin),
                source_locale=None,
            )

        client = await self.client()
        payload = {
            "id": str(uuid4()),
            "channel_id": self._sanitize_text(channel_id, max_len=128),
            "user_id": self._sanitize_text(user_id, max_len=128),
            "text": self._sanitize_text(text, max_len=settings.max_message_length),
            "translated": self._sanitize_optional_text(translated, max_len=settings.max_message_length),
            "sentiment_score": float(sentiment_score),
            "mesh_origin": bool(mesh_origin),
            "created_at": datetime.now(UTC).isoformat(),
            "deleted_at": None,
        }
        response = await self._execute("create_message", client.table("messages").insert(payload))
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_message_by_id(self, message_id: str) -> dict[str, Any] | None:
        """Fetch one message by id."""

        if settings.test_mode:
            return local_store.get_message(self._sanitize_text(message_id, max_len=128))

        client = await self.client()
        response = await self._execute(
            "get_message_by_id",
            client.table("messages")
            .select("id,channel_id,user_id,text,created_at,deleted_at")
            .eq("id", self._sanitize_text(message_id, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def edit_message(self, *, message_id: str, editor_user_id: str, new_text: str) -> dict[str, Any] | None:
        """Edit one message and persist edit history row."""

        if settings.test_mode:
            existing = local_store.get_message(self._sanitize_text(message_id, max_len=128))
            if existing is None:
                return None
            local_store.add_message_edit(
                message_id=str(existing["id"]),
                edited_by=self._sanitize_text(editor_user_id, max_len=128),
                previous_text=str(existing.get("text", "")),
                new_text=self._sanitize_text(new_text, max_len=settings.max_message_length),
            )
            local_store.update_message_text(
                message_id=str(existing["id"]),
                new_text=self._sanitize_text(new_text, max_len=settings.max_message_length),
            )
            return local_store.get_message(str(existing["id"]))

        client = await self.client()
        existing = await self.get_message_by_id(message_id)
        if existing is None:
            return None

        old_text = str(existing.get("text", ""))
        now = datetime.now(UTC)

        await self._execute(
            "create_message_edit_history",
            client.table("message_edits").insert(
                {
                    "id": str(uuid4()),
                    "message_id": self._sanitize_text(message_id, max_len=128),
                    "edited_by": self._sanitize_text(editor_user_id, max_len=128),
                    "previous_text": old_text,
                    "new_text": self._sanitize_text(new_text, max_len=settings.max_message_length),
                    "edited_at": now.isoformat(),
                }
            ),
        )

        response = await self._execute(
            "edit_message",
            client.table("messages")
            .update({"text": self._sanitize_text(new_text, max_len=settings.max_message_length), "updated_at": now.isoformat()})
            .eq("id", self._sanitize_text(message_id, max_len=128)),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def soft_delete_message(self, *, message_id: str) -> dict[str, Any] | None:
        """Soft delete message and redact content."""

        if settings.test_mode:
            safe_message_id = self._sanitize_text(message_id, max_len=128)
            if local_store.get_message(safe_message_id) is None:
                return None
            local_store.soft_delete_message(message_id=safe_message_id)
            return local_store.get_message(safe_message_id)

        client = await self.client()
        response = await self._execute(
            "soft_delete_message",
            client.table("messages")
            .update({"text": "[deleted]", "deleted_at": datetime.now(UTC).isoformat()})
            .eq("id", self._sanitize_text(message_id, max_len=128)),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def get_last_n_messages(self, channel_id: str, *, n: int = 20) -> list[dict[str, Any]]:
        """Fetch most recent non-deleted messages from a channel."""

        if settings.test_mode:
            return local_store.get_last_n_messages(channel_id=self._sanitize_text(channel_id, max_len=128), n=n)

        client = await self.client()
        response = await self._execute(
            "get_last_n_messages",
            client.table("messages")
            .select("id,text,channel_id,user_id,created_at")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(max(1, min(n, 100))),
        )
        rows = self._extract_data(response) or []
        rows.reverse()
        return rows

    async def list_active_channel_ids(self, *, minutes: int = 30) -> list[str]:
        """List channels with message activity in recent window."""

        if settings.test_mode:
            cutoff = (datetime.now(UTC) - timedelta(minutes=minutes)).isoformat()
            return local_store.list_active_channel_ids(cutoff_iso=cutoff)

        client = await self.client()
        cutoff = (datetime.now(UTC) - timedelta(minutes=minutes)).isoformat()
        response = await self._execute(
            "list_active_channel_ids",
            client.table("messages").select("channel_id").gte("created_at", cutoff),
        )
        rows = self._extract_data(response) or []
        return sorted({str(row["channel_id"]) for row in rows if row.get("channel_id")})

    async def save_pulse_snapshot(self, channel_id: str, score: float, label: str) -> dict[str, Any]:
        """Persist pulse snapshot for a channel."""

        if settings.test_mode:
            return local_store.save_pulse_snapshot(
                channel_id=self._sanitize_text(channel_id, max_len=128),
                score=float(score),
                label=self._sanitize_text(label, max_len=32),
            )

        client = await self.client()
        payload = {
            "channel_id": self._sanitize_text(channel_id, max_len=128),
            "score": float(score),
            "label": self._sanitize_text(label, max_len=32),
            "updated_at": datetime.now(UTC).isoformat(),
        }
        response = await self._execute(
            "save_pulse_snapshot",
            client.table("pulse_snapshots").upsert(cast(Any, payload), on_conflict="channel_id"),
        )
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else payload

    async def pulse_snapshot_exists_for_minute(self, channel_id: str, minute_bucket: datetime) -> bool:
        """Check whether minute-level pulse snapshot already exists."""

        if settings.test_mode:
            return False

        client = await self.client()
        response = await self._execute(
            "pulse_snapshot_exists_for_minute",
            client.table("pulse_snapshot_runs")
            .select("id")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .eq("minute_bucket", minute_bucket.astimezone(UTC).isoformat())
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return bool(rows)

    async def mark_pulse_snapshot_run(self, channel_id: str, minute_bucket: datetime) -> None:
        """Record minute-level pulse snapshot execution."""

        if settings.test_mode:
            return

        client = await self.client()
        await self._execute(
            "mark_pulse_snapshot_run",
            client.table("pulse_snapshot_runs").upsert(
                {
                    "id": str(uuid4()),
                    "channel_id": self._sanitize_text(channel_id, max_len=128),
                    "minute_bucket": minute_bucket.astimezone(UTC).isoformat(),
                    "created_at": datetime.now(UTC).isoformat(),
                },
                on_conflict="channel_id,minute_bucket",
            ),
        )

    async def get_pulse_snapshot(self, channel_id: str) -> dict[str, Any] | None:
        """Fetch latest pulse snapshot for a channel."""

        if settings.test_mode:
            return local_store.get_pulse_snapshot(channel_id=self._sanitize_text(channel_id, max_len=128))

        client = await self.client()
        response = await self._execute(
            "get_pulse_snapshot",
            client.table("pulse_snapshots")
            .select("channel_id,score,label,updated_at")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    @staticmethod
    def _compute_carbon_from_kg(kg_co2: float) -> int:
        """Convert kg CO2 into score delta for leaderboard updates."""

        grams = kg_co2 * 1000.0
        return -max(1, int(round(grams / 100.0)))

    async def count_daily_carbon_logs(self, *, user_id: str, workspace_id: str, day: datetime) -> int:
        """Count user logs for one workspace day."""

        if settings.test_mode:
            day_start = day.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            safe_user_id = self._sanitize_text(user_id, max_len=128)
            safe_workspace_id = self._sanitize_text(workspace_id, max_len=128)
            total = 0
            for row in local_store.carbon_logs:
                if row.get("user_id") != safe_user_id or row.get("workspace_id") != safe_workspace_id:
                    continue
                created_at = datetime.fromisoformat(str(row.get("created_at", "")).replace("Z", "+00:00"))
                if day_start <= created_at < day_end:
                    total += 1
            return total

        client = await self.client()
        day_start = day.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        response = await self._execute(
            "count_daily_carbon_logs",
            client.table("carbon_logs")
            .select("id")
            .eq("user_id", self._sanitize_text(user_id, max_len=128))
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .gte("created_at", day_start.isoformat())
            .lt("created_at", day_end.isoformat()),
        )
        rows = self._extract_data(response) or []
        return len(rows)

    async def create_carbon_log(
        self,
        *,
        user_id: str,
        workspace_id: str,
        transport_type: str | None = None,
        kg_co2: float | None = None,
        commute_mode: str | None = None,
        distance_km: float | None = None,
    ) -> dict[str, Any]:
        """Insert or update today's carbon log and keep aggregate score in sync."""

        effective_transport = (transport_type or commute_mode or "").strip().lower()
        if not effective_transport:
            raise HTTPException(status_code=422, detail={"code": "invalid_transport_type", "message": "Invalid transport type."})

        if kg_co2 is None:
            if distance_km is None:
                raise HTTPException(status_code=422, detail={"code": "invalid_kg_co2", "message": "kg_co2 is required."})
            factor = EMISSION_FACTORS_G_PER_KM.get(effective_transport, EMISSION_FACTORS_G_PER_KM[CARBON_BASELINE_MODE])
            kg_co2 = max(0.0, float(distance_km) * float(factor) / 1000.0)

        if effective_transport not in ALLOWED_TRANSPORT_TYPES:
            raise HTTPException(status_code=422, detail={"code": "invalid_transport_type", "message": "Invalid transport type."})
        if kg_co2 < 0.0 or kg_co2 > 500.0:
            raise HTTPException(status_code=422, detail={"code": "invalid_kg_co2", "message": "kg_co2 must be between 0.0 and 500.0."})

        normalized_user_id = self._sanitize_text(user_id, max_len=128)
        normalized_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        score_delta = self._compute_carbon_from_kg(float(kg_co2))

        now = datetime.now(UTC)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        if settings.test_mode:
            existing = None
            for row in local_store.carbon_logs:
                if row.get("user_id") != normalized_user_id or row.get("workspace_id") != normalized_workspace_id:
                    continue
                created_at = datetime.fromisoformat(str(row.get("created_at", "")).replace("Z", "+00:00"))
                if day_start <= created_at < day_end:
                    existing = row
                    break

            if existing:
                previous_score = int(existing.get("score_delta", 0))
                previous_kg = float(existing.get("kg_co2", 0.0))
                existing["transport_type"] = self._sanitize_text(effective_transport, max_len=32)
                existing["kg_co2"] = float(kg_co2)
                existing["score_delta"] = score_delta
                existing["updated_at"] = now.isoformat()
                score_adjustment = score_delta - previous_score
                kg_adjustment = float(kg_co2) - previous_kg
                if score_adjustment != 0 or abs(kg_adjustment) > 1e-9:
                    await self._increment_carbon_score(
                        user_id=normalized_user_id,
                        workspace_id=normalized_workspace_id,
                        score_delta=score_adjustment,
                        kg_delta=kg_adjustment,
                    )
                return dict(existing)

            payload = {
                "id": str(uuid4()),
                "user_id": normalized_user_id,
                "workspace_id": normalized_workspace_id,
                "transport_type": self._sanitize_text(effective_transport, max_len=32),
                "kg_co2": float(kg_co2),
                "score_delta": score_delta,
                "created_at": now.isoformat(),
            }
            local_store.carbon_logs.append(payload)
            await self._increment_carbon_score(
                user_id=normalized_user_id,
                workspace_id=normalized_workspace_id,
                score_delta=score_delta,
                kg_delta=float(kg_co2),
            )
            return payload

        client = await self.client()

        existing_response = await self._execute(
            "get_today_carbon_log",
            client.table("carbon_logs")
            .select("*")
            .eq("user_id", normalized_user_id)
            .eq("workspace_id", normalized_workspace_id)
            .gte("created_at", day_start.isoformat())
            .lt("created_at", day_end.isoformat())
            .order("created_at")
            .limit(1),
        )
        existing_rows = self._extract_data(existing_response) or []
        existing = existing_rows[0] if existing_rows else None

        if existing:
            previous_score = int(existing.get("score_delta", 0))
            previous_kg = float(existing.get("kg_co2", float(existing.get("grams_co2", 0.0)) / 1000.0))
            score_adjustment = score_delta - previous_score
            kg_adjustment = float(kg_co2) - previous_kg

            update_payload = {
                "transport_type": self._sanitize_text(effective_transport, max_len=32),
                "kg_co2": float(kg_co2),
                "score_delta": score_delta,
                "updated_at": now.isoformat(),
            }
            update_response = await self._execute(
                "update_today_carbon_log",
                client.table("carbon_logs").update(cast(Any, update_payload)).eq("id", existing.get("id")),
            )
            updated_rows = self._extract_data(update_response) or []
            updated = cast(dict[str, Any], updated_rows[0]) if updated_rows else {**existing, **update_payload}

            if score_adjustment != 0 or abs(kg_adjustment) > 1e-9:
                await self._increment_carbon_score(
                    user_id=normalized_user_id,
                    workspace_id=normalized_workspace_id,
                    score_delta=score_adjustment,
                    kg_delta=kg_adjustment,
                )
            return updated

        payload: dict[str, Any] = {
            "id": str(uuid4()),
            "user_id": normalized_user_id,
            "workspace_id": normalized_workspace_id,
            "transport_type": self._sanitize_text(effective_transport, max_len=32),
            "kg_co2": float(kg_co2),
            "score_delta": score_delta,
            "created_at": now.isoformat(),
        }

        response = await self._execute("create_carbon_log", client.table("carbon_logs").insert(cast(Any, payload)))
        rows = self._extract_data(response) or []
        inserted = cast(dict[str, Any], rows[0]) if rows else payload

        await self._increment_carbon_score(
            user_id=str(inserted["user_id"]),
            workspace_id=str(inserted["workspace_id"]),
            score_delta=int(cast(Any, inserted["score_delta"])),
            kg_delta=float(cast(Any, inserted["kg_co2"])),
        )
        return inserted

    async def _increment_carbon_score(
        self,
        *,
        user_id: str,
        workspace_id: str,
        score_delta: int,
        kg_delta: float,
    ) -> None:
        """Increment aggregate carbon score for one user in one workspace."""

        if settings.test_mode:
            key = (user_id, workspace_id)
            existing = local_store.carbon_scores.get(key)
            if existing is None:
                local_store.carbon_scores[key] = {
                    "user_id": user_id,
                    "workspace_id": workspace_id,
                    "total_score": int(score_delta),
                    "total_kg_co2": round(float(kg_delta), 3),
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            else:
                existing["total_score"] = int(existing.get("total_score", 0)) + int(score_delta)
                existing["total_kg_co2"] = round(float(existing.get("total_kg_co2", 0.0)) + float(kg_delta), 3)
                existing["updated_at"] = datetime.now(UTC).isoformat()
            return

        client = await self.client()
        existing_response = await self._execute(
            "increment_carbon_score_lookup",
            client.table("carbon_scores")
            .select("user_id,workspace_id,total_score,total_kg_co2")
            .eq("user_id", user_id)
            .eq("workspace_id", workspace_id)
            .limit(1),
        )
        rows = self._extract_data(existing_response) or []

        if rows:
            row = rows[0]
            payload = {
                "total_score": int(row.get("total_score", 0)) + int(score_delta),
                "total_kg_co2": round(float(row.get("total_kg_co2", 0.0)) + float(kg_delta), 3),
                "updated_at": datetime.now(UTC).isoformat(),
            }
            await self._execute(
                "increment_carbon_score_update",
                client.table("carbon_scores")
                .update(cast(Any, payload))
                .eq("user_id", user_id)
                .eq("workspace_id", workspace_id),
            )
        else:
            await self._execute(
                "increment_carbon_score_insert",
                client.table("carbon_scores").insert(
                    {
                        "user_id": user_id,
                        "workspace_id": workspace_id,
                        "total_score": int(score_delta),
                        "total_kg_co2": round(float(kg_delta), 3),
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                ),
            )

    async def get_carbon_leaderboard(self, workspace_id: str) -> list[dict[str, Any]]:
        """Return carbon leaderboard ordered by score descending."""

        if settings.test_mode:
            safe_workspace = self._sanitize_text(workspace_id, max_len=128)
            rows = [row for row in local_store.carbon_scores.values() if row.get("workspace_id") == safe_workspace]
            rows.sort(key=lambda row: (-int(row.get("total_score", 0)), float(row.get("total_kg_co2", 0.0))))
            leaderboard = []
            for row in rows:
                user = local_store.users_by_id.get(str(row.get("user_id", "")))
                leaderboard.append(
                    {
                        "user_id": row.get("user_id"),
                        "display_name": user.display_name if user is not None else None,
                        "total_score": int(row.get("total_score", 0)),
                        "total_kg_co2": float(row.get("total_kg_co2", 0.0)),
                    }
                )
            return leaderboard

        client = await self.client()
        response = await self._execute(
            "get_carbon_leaderboard",
            client.table("carbon_scores")
            .select("user_id,workspace_id,total_score,total_kg_co2,users(display_name)")
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .order("total_score", desc=True)
            .order("total_kg_co2", desc=False)
            .limit(100),
        )
        rows = self._extract_data(response) or []

        leaderboard = []
        for row in rows:
            users_value = row.get("users")
            display_name = users_value.get("display_name") if isinstance(users_value, dict) else None
            leaderboard.append(
                {
                    "user_id": row.get("user_id"),
                    "display_name": display_name,
                    "total_score": int(row.get("total_score", 0)),
                    "total_kg_co2": float(row.get("total_kg_co2", 0.0)),
                }
            )
        return leaderboard

    async def recalculate_carbon_leaderboard(self, workspace_id: str | None = None) -> dict[str, list[dict[str, Any]]]:
        """Recompute carbon_scores from source carbon_logs table."""

        if settings.test_mode:
            aggregates: dict[str, dict[str, dict[str, float | int]]] = {}
            target_workspace = self._sanitize_text(workspace_id, max_len=128) if workspace_id else None
            for row in local_store.carbon_logs:
                ws_id = str(row.get("workspace_id") or "")
                user_id = str(row.get("user_id") or "")
                if not ws_id or not user_id:
                    continue
                if target_workspace and ws_id != target_workspace:
                    continue
                aggregates.setdefault(ws_id, {})
                aggregates[ws_id].setdefault(user_id, {"total_score": 0, "total_kg_co2": 0.0})
                aggregates[ws_id][user_id]["total_score"] = int(aggregates[ws_id][user_id]["total_score"]) + int(row.get("score_delta", 0))
                aggregates[ws_id][user_id]["total_kg_co2"] = float(aggregates[ws_id][user_id]["total_kg_co2"]) + float(row.get("kg_co2", 0.0))

            if target_workspace:
                for key in [key for key in local_store.carbon_scores if key[1] == target_workspace]:
                    local_store.carbon_scores.pop(key, None)
            else:
                local_store.carbon_scores.clear()

            refreshed: dict[str, list[dict[str, Any]]] = {}
            now = datetime.now(UTC).isoformat()
            for ws_id, users_map in aggregates.items():
                entries = []
                for user_id, totals in users_map.items():
                    row = {
                        "workspace_id": ws_id,
                        "user_id": user_id,
                        "total_score": int(totals["total_score"]),
                        "total_kg_co2": round(float(totals["total_kg_co2"]), 3),
                        "updated_at": now,
                    }
                    local_store.carbon_scores[(user_id, ws_id)] = row
                    entries.append(row)
                refreshed[ws_id] = sorted(entries, key=lambda entry: (-entry["total_score"], entry["total_kg_co2"]))
            return refreshed

        client = await self.client()
        query = client.table("carbon_logs").select("workspace_id,user_id,score_delta,kg_co2")
        if workspace_id:
            query = query.eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))

        response = await self._execute("recalculate_carbon_leaderboard", query)
        rows = self._extract_data(response) or []

        aggregates: dict[str, dict[str, dict[str, float | int]]] = {}
        for row in rows:
            ws_id = str(row.get("workspace_id") or "")
            user_id = str(row.get("user_id") or "")
            if not ws_id or not user_id:
                continue
            if ws_id not in aggregates:
                aggregates[ws_id] = {}
            if user_id not in aggregates[ws_id]:
                aggregates[ws_id][user_id] = {"total_score": 0, "total_kg_co2": 0.0}
            aggregates[ws_id][user_id]["total_score"] = int(aggregates[ws_id][user_id]["total_score"]) + int(row.get("score_delta", 0))
            aggregates[ws_id][user_id]["total_kg_co2"] = float(aggregates[ws_id][user_id]["total_kg_co2"]) + float(row.get("kg_co2", 0.0))

        now = datetime.now(UTC).isoformat()
        refreshed: dict[str, list[dict[str, Any]]] = {}

        for ws_id, users_map in aggregates.items():
            entries = []
            for user_id, totals in users_map.items():
                entries.append(
                    {
                        "workspace_id": ws_id,
                        "user_id": user_id,
                        "total_score": int(totals["total_score"]),
                        "total_kg_co2": round(float(totals["total_kg_co2"]), 3),
                        "updated_at": now,
                    }
                )
            if entries:
                await self._execute(
                    "recalculate_carbon_upsert",
                    client.table("carbon_scores").upsert(cast(Any, entries), on_conflict="workspace_id,user_id"),
                )
                refreshed[ws_id] = sorted(entries, key=lambda row: (-row["total_score"], row["total_kg_co2"]))

        return refreshed

    async def create_mesh_node(self, *, workspace_id: str, node_id: str, secret_hash: str) -> dict[str, Any]:
        """Persist mesh node record for per-node auth."""

        if settings.test_mode:
            return local_store.create_mesh_node(
                workspace_id=self._sanitize_text(workspace_id, max_len=128),
                node_id=self._sanitize_text(node_id, max_len=128),
                secret_hash=self._sanitize_text(secret_hash, max_len=128),
            )

        client = await self.client()
        payload = {
            "id": str(uuid4()),
            "node_id": self._sanitize_text(node_id, max_len=128),
            "secret_hash": self._sanitize_text(secret_hash, max_len=128),
            "workspace_id": self._sanitize_text(workspace_id, max_len=128),
            "registered_at": datetime.now(UTC).isoformat(),
            "last_seen": None,
            "revoked": False,
        }
        response = await self._execute("create_mesh_node", client.table("mesh_nodes").insert(cast(Any, payload)))
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else payload

    async def list_mesh_nodes(self, *, workspace_id: str) -> list[dict[str, Any]]:
        """List all mesh nodes for a workspace in newest-first order."""

        if settings.test_mode:
            return local_store.list_mesh_nodes(workspace_id=self._sanitize_text(workspace_id, max_len=128))

        client = await self.client()
        response = await self._execute(
            "list_mesh_nodes",
            client.table("mesh_nodes")
            .select("id,node_id,workspace_id,registered_at,last_seen,revoked")
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .order("registered_at", desc=True),
        )
        rows = self._extract_data(response) or []
        return cast(list[dict[str, Any]], rows)

    async def get_mesh_node(self, node_id: str) -> dict[str, Any] | None:
        """Fetch one mesh node by node_id."""

        if settings.test_mode:
            return local_store.get_mesh_node(self._sanitize_text(node_id, max_len=128))

        client = await self.client()
        response = await self._execute(
            "get_mesh_node",
            client.table("mesh_nodes")
            .select("id,node_id,secret_hash,workspace_id,registered_at,last_seen,revoked")
            .eq("node_id", self._sanitize_text(node_id, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return cast(dict[str, Any], rows[0]) if rows else None

    async def revoke_mesh_node(self, *, node_id: str, workspace_id: str) -> bool:
        """Revoke one mesh node scoped to workspace ownership."""

        if settings.test_mode:
            return local_store.revoke_mesh_node(
                node_id=self._sanitize_text(node_id, max_len=128),
                workspace_id=self._sanitize_text(workspace_id, max_len=128),
            )

        client = await self.client()
        response = await self._execute(
            "revoke_mesh_node",
            client.table("mesh_nodes")
            .update(cast(Any, {"revoked": True}))
            .eq("node_id", self._sanitize_text(node_id, max_len=128))
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128)),
        )
        rows = self._extract_data(response) or []
        return bool(rows)

    async def update_mesh_node_last_seen(self, node_id: str) -> None:
        """Update last_seen timestamp for verified mesh node."""

        if settings.test_mode:
            local_store.update_mesh_node_last_seen(self._sanitize_text(node_id, max_len=128))
            return

        client = await self.client()
        await self._execute(
            "update_mesh_node_last_seen",
            client.table("mesh_nodes")
            .update({"last_seen": datetime.now(UTC).isoformat()})
            .eq("node_id", self._sanitize_text(node_id, max_len=128)),
        )

    async def sync_mesh_messages(self, messages: list[dict[str, Any]], *, workspace_id: str, source_node_id: str) -> int:
        """Persist relay-delivered mesh messages for audit and reconciliation."""

        if not messages:
            return 0

        if settings.test_mode:
            safe_workspace = self._sanitize_text(workspace_id, max_len=128)
            return local_store.sync_mesh_messages(messages=messages, workspace_id=safe_workspace)

        client = await self.client()
        rows_to_insert: list[dict[str, Any]] = []
        for incoming in messages:
            channel_id = self._sanitize_text(str(incoming.get("channelId") or incoming.get("channel_id") or ""), max_len=128)
            user_id = self._sanitize_text(str(incoming.get("userId") or incoming.get("user_id") or ""), max_len=128)
            text_value = self._sanitize_text(str(incoming.get("text") or ""), max_len=settings.max_message_length)
            if not channel_id or not user_id or not text_value:
                continue

            message_id = self._sanitize_text(str(incoming.get("id") or uuid4()), max_len=128)
            rows_to_insert.append(
                {
                    "id": message_id,
                    "channel_id": channel_id,
                    "user_id": user_id,
                    "workspace_id": self._sanitize_text(workspace_id, max_len=128),
                    "text": text_value,
                    "text_translated": self._sanitize_optional_text(
                        str(incoming.get("textTranslated") or incoming.get("text_translated") or "") or None,
                        max_len=settings.max_message_length,
                    ),
                    "source_locale": self._sanitize_optional_text(str(incoming.get("sourceLocale") or incoming.get("source_locale") or "") or None, max_len=16),
                    "sentiment_score": incoming.get("sentimentScore") or incoming.get("sentiment_score"),
                    "mesh_origin": True,
                    "deleted_at": None,
                    "created_at": datetime.now(UTC).isoformat(),
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )

        if not rows_to_insert:
            return 0

        await self._execute(
            "sync_mesh_messages",
            client.table("messages").upsert(cast(Any, rows_to_insert), on_conflict="id"),
        )
        return len(rows_to_insert)


# Shared database singleton for routers and services.
db = DatabaseClient()


"""
SQL MIGRATION (apply separately)

create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null,
  token_hash text not null unique,
  workspace_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  revoked_at timestamptz null,
  device_hint text null
);
create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_expires on refresh_tokens(expires_at);

create or replace function rotate_refresh_token(
  p_old_token_hash text,
  p_new_token_hash text,
  p_user_id uuid,
  p_workspace_id uuid,
  p_expires_at timestamptz,
  p_device_hint text
) returns boolean
language plpgsql
as $$
begin
  update refresh_tokens
  set revoked = true, revoked_at = now()
  where token_hash = p_old_token_hash and revoked = false and expires_at > now();

  if not found then
    return false;
  end if;

  insert into refresh_tokens(id, user_id, token_hash, workspace_id, issued_at, expires_at, revoked, revoked_at, device_hint)
  values (gen_random_uuid(), p_user_id, p_new_token_hash, p_workspace_id, now(), p_expires_at, false, null, p_device_hint);

  return true;
end;
$$;

create table if not exists mesh_nodes (
  id uuid primary key,
  node_id text not null unique,
  secret_hash text not null,
  workspace_id uuid not null,
  registered_at timestamptz not null default now(),
  last_seen timestamptz null,
  revoked boolean not null default false
);

create table if not exists message_edits (
  id uuid primary key,
  message_id uuid not null,
  edited_by uuid not null,
  previous_text text not null,
  new_text text not null,
  edited_at timestamptz not null default now()
);

create table if not exists pulse_snapshot_runs (
  id uuid primary key,
  channel_id uuid not null,
  minute_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique(channel_id, minute_bucket)
);
"""
