"""Asynchronous Supabase database access layer."""

from __future__ import annotations

import asyncio
import logging
import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from supabase import AsyncClient, acreate_client

from app.config import settings

logger = logging.getLogger(__name__)

CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
CARBON_BASELINE_MODE = "car"
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
}


class DatabaseError(RuntimeError):
    """Raised when database operations fail."""


class DatabaseClient:
    """Encapsulates async Supabase operations for the API and workers."""

    def __init__(self) -> None:
        self._client: AsyncClient | None = None
        self._lock = asyncio.Lock()

    async def client(self) -> AsyncClient:
        """Return a lazily initialized Supabase async client."""

        if self._client is not None:
            return self._client

        async with self._lock:
            if self._client is None:
                self._client = await acreate_client(settings.supabase_url, settings.supabase_api_key)
                logger.info("supabase_client_initialized")

        return self._client

    @staticmethod
    def _sanitize_text(value: str, *, max_len: int = 2000) -> str:
        """Normalize user-provided text before writing to storage."""

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
        """Extract data payload from Supabase/PostgREST response objects."""

        return getattr(result, "data", result)

    async def healthcheck(self) -> bool:
        """Run a minimal read query to confirm Supabase connectivity."""

        client = await self.client()
        try:
            response = await client.table("channels").select("id").limit(1).execute()
            _ = self._extract_data(response)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("supabase_healthcheck_failed", extra={"error": str(exc)})
            return False

    async def authenticate_user(self, email: str, password: str) -> dict[str, Any] | None:
        """Authenticate with Supabase Auth and ensure a local profile exists."""

        client = await self.client()
        normalized_email = self._sanitize_text(email.lower(), max_len=320)

        try:
            auth_response = await client.auth.sign_in_with_password(
                {"email": normalized_email, "password": password}
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("auth_login_failed", extra={"email": normalized_email, "error": str(exc)})
            return None

        user = getattr(auth_response, "user", None)
        session = getattr(auth_response, "session", None)
        if user is None:
            return None

        display_name = (
            user.user_metadata.get("full_name")
            if isinstance(getattr(user, "user_metadata", None), dict)
            else None
        )
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
        """Insert or update the user profile table row."""

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

        response = (
            await client.table("users")
            .upsert(payload, on_conflict="id")
            .execute()
        )
        data = self._extract_data(response) or []
        return data[0] if data else payload

    async def get_user_preferences(self, user_id: str) -> dict[str, Any]:
        """Fetch user preferences by user id."""

        client = await self.client()
        response = (
            await client.table("users")
            .select("locale,coaching_enabled,accessibility_settings")
            .eq("id", self._sanitize_text(user_id, max_len=128))
            .limit(1)
            .execute()
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
        """Patch user preference values and return the latest row."""

        client = await self.client()
        payload: dict[str, Any] = {"updated_at": datetime.now(UTC).isoformat()}
        if locale is not None:
            payload["locale"] = self._sanitize_text(locale, max_len=16)
        if coaching_enabled is not None:
            payload["coaching_enabled"] = bool(coaching_enabled)
        if accessibility_settings is not None:
            payload["accessibility_settings"] = accessibility_settings

        await client.table("users").update(payload).eq("id", self._sanitize_text(user_id, max_len=128)).execute()
        return await self.get_user_preferences(user_id)

    async def list_channels(self, workspace_id: str) -> list[dict[str, Any]]:
        """List channels for a workspace sorted by creation date."""

        client = await self.client()
        response = (
            await client.table("channels")
            .select("id,workspace_id,name,description,tone,created_by,created_at")
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .order("created_at", desc=False)
            .execute()
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
        response = await client.table("channels").insert(payload).execute()
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_channel(self, channel_id: str) -> dict[str, Any] | None:
        """Fetch a channel row by id."""

        client = await self.client()
        response = (
            await client.table("channels")
            .select("id,workspace_id,name,tone")
            .eq("id", self._sanitize_text(channel_id, max_len=128))
            .limit(1)
            .execute()
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
        """Return cursor-paginated channel messages ordered ascending in response."""

        client = await self.client()
        safe_limit = max(1, min(limit, MAX_PAGE_SIZE))

        query = (
            client.table("messages")
            .select("id,channel_id,user_id,text,translated,sentiment_score,mesh_origin,created_at")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .order("created_at", desc=True)
            .limit(safe_limit + 1)
        )

        if cursor:
            query = query.lt("created_at", self._sanitize_text(cursor, max_len=64))

        response = await query.execute()
        rows = self._extract_data(response) or []

        next_cursor: str | None = None
        if len(rows) > safe_limit:
            next_cursor = rows[-1]["created_at"]
            rows = rows[:safe_limit]

        rows.reverse()
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
        }
        response = await client.table("messages").insert(payload).execute()
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_last_n_messages(self, channel_id: str, *, n: int = 20) -> list[dict[str, Any]]:
        """Fetch the most recent messages from a channel."""

        client = await self.client()
        response = (
            await client.table("messages")
            .select("id,text,channel_id,user_id,created_at")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .order("created_at", desc=True)
            .limit(max(1, min(n, 100)))
            .execute()
        )
        rows = self._extract_data(response) or []
        rows.reverse()
        return rows

    async def list_active_channel_ids(self, *, minutes: int = 30) -> list[str]:
        """List channels with message activity in the recent window."""

        client = await self.client()
        cutoff = (datetime.now(UTC) - timedelta(minutes=minutes)).isoformat()
        response = (
            await client.table("messages")
            .select("channel_id")
            .gte("created_at", cutoff)
            .execute()
        )
        rows = self._extract_data(response) or []
        return sorted({row["channel_id"] for row in rows if row.get("channel_id")})

    async def save_pulse_snapshot(self, channel_id: str, score: float, label: str) -> dict[str, Any]:
        """Persist a pulse snapshot for a channel."""

        client = await self.client()
        payload = {
            "channel_id": self._sanitize_text(channel_id, max_len=128),
            "score": float(score),
            "label": self._sanitize_text(label, max_len=32),
            "updated_at": datetime.now(UTC).isoformat(),
        }
        response = await client.table("pulse_snapshots").upsert(payload, on_conflict="channel_id").execute()
        rows = self._extract_data(response) or []
        return rows[0] if rows else payload

    async def get_pulse_snapshot(self, channel_id: str) -> dict[str, Any] | None:
        """Fetch latest pulse snapshot for a channel."""

        client = await self.client()
        response = (
            await client.table("pulse_snapshots")
            .select("channel_id,score,label,updated_at")
            .eq("channel_id", self._sanitize_text(channel_id, max_len=128))
            .limit(1)
            .execute()
        )
        rows = self._extract_data(response) or []
        return rows[0] if rows else None

    @staticmethod
    def _compute_carbon(distance_km: float, commute_mode: str) -> tuple[float, int]:
        """Calculate grams CO2 and score delta based on commute mode and distance."""

        mode = commute_mode.lower().strip()
        factor = EMISSION_FACTORS_G_PER_KM.get(mode, EMISSION_FACTORS_G_PER_KM[CARBON_BASELINE_MODE])
        baseline = EMISSION_FACTORS_G_PER_KM[CARBON_BASELINE_MODE] * distance_km
        grams = factor * distance_km
        saved = baseline - grams

        if mode == CARBON_BASELINE_MODE:
            score_delta = -max(1, int(round(grams / 100.0)))
        else:
            score_delta = max(1, int(round(saved / 10.0)))

        return round(grams, 2), score_delta

    async def create_carbon_log(
        self,
        *,
        user_id: str,
        workspace_id: str,
        commute_mode: str,
        distance_km: float,
    ) -> dict[str, Any]:
        """Insert carbon log and update score cache table."""

        client = await self.client()
        grams_co2, score_delta = self._compute_carbon(distance_km, commute_mode)

        payload = {
            "id": str(uuid4()),
            "user_id": self._sanitize_text(user_id, max_len=128),
            "workspace_id": self._sanitize_text(workspace_id, max_len=128),
            "commute_mode": self._sanitize_text(commute_mode.lower(), max_len=32),
            "distance_km": float(distance_km),
            "grams_co2": grams_co2,
            "score_delta": score_delta,
            "created_at": datetime.now(UTC).isoformat(),
        }

        response = await client.table("carbon_logs").insert(payload).execute()
        rows = self._extract_data(response) or []
        inserted = rows[0] if rows else payload

        await self._increment_carbon_score(
            user_id=inserted["user_id"],
            workspace_id=inserted["workspace_id"],
            score_delta=inserted["score_delta"],
            grams_delta=inserted["grams_co2"],
        )
        return inserted

    async def _increment_carbon_score(
        self,
        *,
        user_id: str,
        workspace_id: str,
        score_delta: int,
        grams_delta: float,
    ) -> None:
        """Increment aggregate carbon score for a user in a workspace."""

        client = await self.client()

        existing_response = (
            await client.table("carbon_scores")
            .select("user_id,workspace_id,total_score,total_grams_co2")
            .eq("user_id", user_id)
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        rows = self._extract_data(existing_response) or []

        if rows:
            row = rows[0]
            total_score = int(row.get("total_score", 0)) + int(score_delta)
            total_grams = float(row.get("total_grams_co2", 0.0)) + float(grams_delta)
            payload = {
                "user_id": user_id,
                "workspace_id": workspace_id,
                "total_score": total_score,
                "total_grams_co2": round(total_grams, 2),
                "updated_at": datetime.now(UTC).isoformat(),
            }
            await (
                client.table("carbon_scores")
                .update(payload)
                .eq("user_id", user_id)
                .eq("workspace_id", workspace_id)
                .execute()
            )
        else:
            payload = {
                "user_id": user_id,
                "workspace_id": workspace_id,
                "total_score": int(score_delta),
                "total_grams_co2": round(float(grams_delta), 2),
                "updated_at": datetime.now(UTC).isoformat(),
            }
            await client.table("carbon_scores").insert(payload).execute()

    async def get_carbon_leaderboard(self, workspace_id: str) -> list[dict[str, Any]]:
        """Return the carbon leaderboard ordered by total score descending."""

        client = await self.client()
        response = (
            await client.table("carbon_scores")
            .select("user_id,workspace_id,total_score,total_grams_co2,users(display_name)")
            .eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))
            .order("total_score", desc=True)
            .limit(100)
            .execute()
        )
        rows = self._extract_data(response) or []

        leaderboard = []
        for row in rows:
            display_name = None
            users_value = row.get("users")
            if isinstance(users_value, dict):
                display_name = users_value.get("display_name")
            leaderboard.append(
                {
                    "user_id": row.get("user_id"),
                    "display_name": display_name,
                    "total_score": int(row.get("total_score", 0)),
                    "total_grams_co2": float(row.get("total_grams_co2", 0.0)),
                }
            )

        return leaderboard

    async def recalculate_carbon_leaderboard(self, workspace_id: str | None = None) -> dict[str, list[dict[str, Any]]]:
        """Recompute aggregate carbon scores from the source logs table."""

        client = await self.client()
        query = client.table("carbon_logs").select("workspace_id,user_id,score_delta,grams_co2")
        if workspace_id:
            query = query.eq("workspace_id", self._sanitize_text(workspace_id, max_len=128))

        response = await query.execute()
        rows = self._extract_data(response) or []

        aggregates: dict[str, dict[str, dict[str, float | int]]] = defaultdict(dict)
        for row in rows:
            ws_id = row.get("workspace_id")
            user_id = row.get("user_id")
            if not ws_id or not user_id:
                continue

            ws_map = aggregates.setdefault(ws_id, {})
            state = ws_map.setdefault(user_id, {"total_score": 0, "total_grams_co2": 0.0})
            state["total_score"] = int(state["total_score"]) + int(row.get("score_delta", 0))
            state["total_grams_co2"] = float(state["total_grams_co2"]) + float(row.get("grams_co2", 0.0))

        refreshed: dict[str, list[dict[str, Any]]] = {}
        now = datetime.now(UTC).isoformat()

        for ws_id, users_map in aggregates.items():
            entries = []
            for user_id, totals in users_map.items():
                entry = {
                    "workspace_id": ws_id,
                    "user_id": user_id,
                    "total_score": int(totals["total_score"]),
                    "total_grams_co2": round(float(totals["total_grams_co2"]), 2),
                    "updated_at": now,
                }
                entries.append(entry)

            if entries:
                await client.table("carbon_scores").upsert(entries, on_conflict="workspace_id,user_id").execute()
                refreshed[ws_id] = sorted(entries, key=lambda item: item["total_score"], reverse=True)

        return refreshed

    async def sync_mesh_messages(self, messages: list[dict[str, Any]]) -> int:
        """Persist relay-delivered mesh messages for audit/sync processing."""

        if not messages:
            return 0

        client = await self.client()
        rows_to_insert = []
        for incoming in messages:
            message_id = self._sanitize_text(str(incoming.get("id") or uuid4()), max_len=128)
            rows_to_insert.append(
                {
                    "id": message_id,
                    "channel_id": self._sanitize_text(str(incoming.get("channelId", "")), max_len=128),
                    "source_node": self._sanitize_optional_text(
                        str(incoming.get("sourceNode", "")), max_len=128
                    ),
                    "payload": incoming,
                    "created_at": datetime.now(UTC).isoformat(),
                }
            )

        await client.table("mesh_messages").upsert(rows_to_insert, on_conflict="id").execute()
        return len(rows_to_insert)


# Shared database singleton for routers and services.
db = DatabaseClient()
