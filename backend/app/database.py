"""Asynchronous Supabase database access layer with authorization and metrics."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from redis.asyncio import Redis
from supabase import AsyncClient, acreate_client

from app.config import settings
from app.metrics import db_query_duration_seconds

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

    async def healthcheck(self) -> bool:
        """Run a minimal read query to confirm Supabase connectivity."""

        client = await self.client()
        try:
            response = await self._execute("healthcheck", client.table("channels").select("id").limit(1))
            _ = self._extract_data(response)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("supabase_healthcheck_failed", extra={"error": str(exc)})
            return False

    async def authenticate_user(self, email: str, password: str) -> dict[str, Any] | None:
        """Authenticate with Supabase Auth and ensure profile exists."""

        client = await self.client()
        normalized_email = self._sanitize_text(email.lower(), max_len=320)

        try:
            auth_response = await client.auth.sign_in_with_password({"email": normalized_email, "password": password})
        except Exception as exc:  # noqa: BLE001
            logger.warning("auth_login_failed", extra={"email": normalized_email, "error": str(exc)})
            return None

        user = getattr(auth_response, "user", None)
        session = getattr(auth_response, "session", None)
        if user is None:
            return None

        display_name = user.user_metadata.get("full_name") if isinstance(getattr(user, "user_metadata", None), dict) else None
        await self.upsert_user_profile(
            user_id=user.id,
            email=user.email or normalized_email,
            display_name=display_name,
            locale="en-US",
        )

        return {
            "user": {"id": user.id, "email": user.email or normalized_email, "display_name": display_name},
            "supabase_access_token": getattr(session, "access_token", None),
        }

    async def send_magic_link(self, email: str) -> None:
        """Send a Supabase magic-link login email."""

        client = await self.client()
        normalized_email = self._sanitize_text(email.lower(), max_len=320)
        await client.auth.sign_in_with_otp({"email": normalized_email})

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

        client = await self.client()
        payload = {
            "id": self._sanitize_text(user_id, max_len=128),
            "email": self._sanitize_text(email.lower(), max_len=320),
            "display_name": self._sanitize_optional_text(display_name, max_len=120),
            "locale": self._sanitize_text(locale, max_len=16),
            "coaching_enabled": bool(coaching_enabled),
            "accessibility_settings": accessibility_settings or {},
            "updated_at": datetime.now(UTC).isoformat(),
        }

        response = await self._execute("upsert_user_profile", client.table("users").upsert(payload, on_conflict="id"))
        data = self._extract_data(response) or []
        return data[0] if data else payload

    async def get_user_preferences(self, user_id: str) -> dict[str, Any]:
        """Fetch user preferences by user id."""

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
        return rows[0]

    async def update_user_preferences(
        self,
        user_id: str,
        *,
        locale: str | None,
        coaching_enabled: bool | None,
        accessibility_settings: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Patch user preference values and return latest row."""

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

        client = await self.client()
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
            return None
        return str(rows[0]["workspace_id"])

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

        client = await self.client()
        payload = {
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
        response = await self._execute("create_refresh_token", client.table("refresh_tokens").insert(payload))
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_refresh_token_by_hash(self, token_hash: str) -> dict[str, Any] | None:
        """Load refresh token row by hashed token value."""

        client = await self.client()
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

        client = await self.client()
        await self._execute(
            "revoke_refresh_token",
            client.table("refresh_tokens")
            .update({"revoked": True, "revoked_at": datetime.now(UTC).isoformat()})
            .eq("token_hash", self._sanitize_text(token_hash, max_len=128)),
        )

    async def revoke_all_refresh_tokens_for_user(self, user_id: str) -> None:
        """Revoke all refresh tokens for one user (reuse detection response)."""

        client = await self.client()
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

        client = await self.client()
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

        client = await self.client()
        response = await self._execute(
            "list_channels",
            client.table("channels")
            .select("id,workspace_id,name,description,tone,created_by,created_at")
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
    ) -> dict[str, Any]:
        """Create a new channel and return the created record."""

        client = await self.client()
        payload = {
            "id": str(uuid4()),
            "workspace_id": self._sanitize_text(workspace_id, max_len=128),
            "name": self._sanitize_text(name, max_len=settings.max_channel_name_length),
            "description": self._sanitize_optional_text(description, max_len=500),
            "tone": self._sanitize_text(tone, max_len=64),
            "created_by": self._sanitize_text(created_by, max_len=128),
            "created_at": datetime.now(UTC).isoformat(),
        }
        response = await self._execute("create_channel", client.table("channels").insert(payload))
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_channel(self, channel_id: str) -> dict[str, Any] | None:
        """Fetch channel row by id."""

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

    async def list_messages(
        self,
        *,
        channel_id: str,
        cursor: str | None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> dict[str, Any]:
        """Return cursor-paginated channel messages using message UUID cursor."""

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

        client = await self.client()
        payload = {
            "channel_id": self._sanitize_text(channel_id, max_len=128),
            "score": float(score),
            "label": self._sanitize_text(label, max_len=32),
            "updated_at": datetime.now(UTC).isoformat(),
        }
        response = await self._execute(
            "save_pulse_snapshot",
            client.table("pulse_snapshots").upsert(payload, on_conflict="channel_id"),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def pulse_snapshot_exists_for_minute(self, channel_id: str, minute_bucket: datetime) -> bool:
        """Check whether minute-level pulse snapshot already exists."""

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

        client = await self.client()
        day_start = day.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        response = await self._execute(
            "count_daily_carbon_logs",
            client.table("carbon_logs")
            .select("id", count="exact")
            .eq("user_id", self._sanitize_text(user_id, max_len=128))
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .gte("created_at", day_start.isoformat())
            .lt("created_at", day_end.isoformat()),
        )
        count_value = getattr(response, "count", None)
        if isinstance(count_value, int):
            return count_value
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

        client = await self.client()
        normalized_user_id = self._sanitize_text(user_id, max_len=128)
        normalized_workspace_id = self._sanitize_text(workspace_id, max_len=128)
        score_delta = self._compute_carbon_from_kg(float(kg_co2))

        now = datetime.now(UTC)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

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
                client.table("carbon_logs").update(update_payload).eq("id", existing.get("id")),
            )
            updated_rows = self._extract_data(update_response) or []
            updated = updated_rows[0] if updated_rows else {**existing, **update_payload}

            if score_adjustment != 0 or abs(kg_adjustment) > 1e-9:
                await self._increment_carbon_score(
                    user_id=normalized_user_id,
                    workspace_id=normalized_workspace_id,
                    score_delta=score_adjustment,
                    kg_delta=kg_adjustment,
                )
            return updated

        payload = {
            "id": str(uuid4()),
            "user_id": normalized_user_id,
            "workspace_id": normalized_workspace_id,
            "transport_type": self._sanitize_text(effective_transport, max_len=32),
            "kg_co2": float(kg_co2),
            "score_delta": score_delta,
            "created_at": now.isoformat(),
        }

        response = await self._execute("create_carbon_log", client.table("carbon_logs").insert(payload))
        rows = self._extract_data(response) or []
        inserted = rows[0] if rows else payload

        await self._increment_carbon_score(
            user_id=inserted["user_id"],
            workspace_id=inserted["workspace_id"],
            score_delta=int(inserted["score_delta"]),
            kg_delta=float(inserted["kg_co2"]),
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
                .update(payload)
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
                    client.table("carbon_scores").upsert(entries, on_conflict="workspace_id,user_id"),
                )
                refreshed[ws_id] = sorted(entries, key=lambda row: (-row["total_score"], row["total_kg_co2"]))

        return refreshed

    async def create_mesh_node(self, *, workspace_id: str, node_id: str, secret_hash: str) -> dict[str, Any]:
        """Persist mesh node record for per-node auth."""

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
        response = await self._execute("create_mesh_node", client.table("mesh_nodes").insert(payload))
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_mesh_node(self, node_id: str) -> dict[str, Any] | None:
        """Fetch one mesh node by node_id."""

        client = await self.client()
        response = await self._execute(
            "get_mesh_node",
            client.table("mesh_nodes")
            .select("id,node_id,secret_hash,workspace_id,registered_at,last_seen,revoked")
            .eq("node_id", self._sanitize_text(node_id, max_len=128))
            .limit(1),
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    async def update_mesh_node_last_seen(self, node_id: str) -> None:
        """Update last_seen timestamp for verified mesh node."""

        client = await self.client()
        await self._execute(
            "update_mesh_node_last_seen",
            client.table("mesh_nodes")
            .update({"last_seen": datetime.now(UTC).isoformat()})
            .eq("node_id", self._sanitize_text(node_id, max_len=128)),
        )

    async def sync_mesh_messages(self, messages: list[dict[str, Any]]) -> int:
        """Persist relay-delivered mesh messages for audit and reconciliation."""

        if not messages:
            return 0

        client = await self.client()
        rows_to_insert: list[dict[str, Any]] = []
        for incoming in messages:
            message_id = self._sanitize_text(str(incoming.get("id") or uuid4()), max_len=128)
            rows_to_insert.append(
                {
                    "id": message_id,
                    "channel_id": self._sanitize_text(str(incoming.get("channelId", "")), max_len=128),
                    "source_node": self._sanitize_optional_text(str(incoming.get("sourceNode", "")), max_len=128),
                    "payload": incoming,
                    "created_at": datetime.now(UTC).isoformat(),
                }
            )

        await self._execute("sync_mesh_messages", client.table("mesh_messages").upsert(rows_to_insert, on_conflict="id"))
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
