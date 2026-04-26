"""In-memory fallback store used for local TEST_MODE probes."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import hmac
from secrets import token_hex
from typing import Any
from uuid import uuid4


ROLE_PRIORITY = {"member": 1, "admin": 2, "owner": 3}
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


@dataclass(slots=True)
class LocalUser:
    id: str
    email: str
    password_hash: str
    display_name: str
    locale: str = "en-US"
    coaching_enabled: bool = True
    accessibility_settings: dict[str, Any] | None = None
    bio: str | None = None
    timezone: str | None = None
    avatar_url: str | None = None


class LocalStore:
    """Process-local state to emulate core persistence flows in TEST_MODE."""

    def __init__(self) -> None:
        self.users_by_email: dict[str, LocalUser] = {}
        self.users_by_id: dict[str, LocalUser] = {}
        self.workspaces: dict[str, dict[str, Any]] = {}
        self.workspace_members: list[dict[str, Any]] = []
        self.workspace_domains: dict[str, str] = {}
        self.workspace_invitations: list[dict[str, Any]] = []
        self.workspace_join_requests: list[dict[str, Any]] = []

        self.refresh_tokens: dict[str, dict[str, Any]] = {}
        self.channels: dict[str, dict[str, Any]] = {}
        self.messages: dict[str, dict[str, Any]] = {}
        self.message_edits: list[dict[str, Any]] = []
        self.message_reactions: list[dict[str, Any]] = []

        self.carbon_logs: list[dict[str, Any]] = []
        self.carbon_scores: dict[tuple[str, str], dict[str, Any]] = {}

        self.mesh_nodes: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _hash_password(password: str) -> str:
        iterations = 260_000
        salt = token_hex(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
        return f"pbkdf2_sha256${iterations}${salt}${digest}"

    @staticmethod
    def _verify_password(password: str, stored_hash: str) -> bool:
        value = str(stored_hash or "")
        if value.startswith("pbkdf2_sha256$"):
            parts = value.split("$", 3)
            if len(parts) != 4:
                return False
            _, iterations_raw, salt, expected = parts
            try:
                iterations = int(iterations_raw)
            except ValueError:
                return False
            actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
            return hmac.compare_digest(actual, expected)

        # Backward-compatible verification for old sha256-only fallback records.
        legacy = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy, value)

    @staticmethod
    def _initials(name: str) -> str:
        parts = [part for part in name.strip().split() if part]
        if not parts:
            return "??"
        if len(parts) == 1:
            return parts[0][:2].upper()
        return f"{parts[0][0]}{parts[-1][0]}".upper()

    @staticmethod
    def _extract_domain(email: str) -> str | None:
        parts = email.strip().lower().split("@", 1)
        if len(parts) != 2 or not parts[1]:
            return None
        return parts[1]

    @staticmethod
    def _is_company_domain(domain: str | None) -> bool:
        if not domain:
            return False
        return "." in domain and domain not in PERSONAL_EMAIL_DOMAINS

    def register_user(
        self,
        *,
        email: str,
        password: str,
        name: str,
        company_name: str | None = None,
        locale: str | None = None,
    ) -> dict[str, Any]:
        normalized_email = email.strip().lower()
        if normalized_email in self.users_by_email:
            raise ValueError("email_already_exists")

        user_id = str(uuid4())
        display_name = name.strip() or normalized_email.split("@", 1)[0]
        user = LocalUser(
            id=user_id,
            email=normalized_email,
            password_hash=self._hash_password(password),
            display_name=display_name,
            locale=locale or "en-US",
            accessibility_settings={},
        )
        self.users_by_email[normalized_email] = user
        self.users_by_id[user_id] = user

        now_iso = self._now().isoformat()
        domain = self._extract_domain(normalized_email)
        company_domain = domain if self._is_company_domain(domain) else None

        workspace_id = self.workspace_domains.get(company_domain) if company_domain else None
        role = "member"

        if workspace_id is None:
            workspace_id = str(uuid4())
            if company_name and company_name.strip():
                workspace_name = f"{company_name.strip()} Workspace"
            elif company_domain:
                workspace_name = f"{company_domain.split('.', 1)[0].replace('-', ' ').title()} Workspace"
            else:
                workspace_name = f"{display_name}'s Workspace"

            self.workspaces[workspace_id] = {
                "id": workspace_id,
                "name": workspace_name,
                "slug": f"ws-{workspace_id[:8]}",
                "created_at": now_iso,
            }
            role = "owner"

            if company_domain:
                self.workspace_domains[company_domain] = workspace_id

        self.workspace_members.append(
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "role": role,
                "joined_at": now_iso,
            }
        )

        return {
            "user": {
                "id": user_id,
                "email": normalized_email,
                "display_name": display_name,
            },
            "workspace_id": workspace_id,
        }

    def authenticate_user(self, *, email: str, password: str) -> dict[str, Any] | None:
        normalized_email = email.strip().lower()
        user = self.users_by_email.get(normalized_email)
        if user is None:
            return None
        if not self._verify_password(password, user.password_hash):
            return None

        workspace_id = self.get_default_workspace_for_user(user.id)
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
            },
            "workspace_id": workspace_id,
            "supabase_access_token": None,
        }

    def get_default_workspace_for_user(self, user_id: str) -> str | None:
        memberships = [m for m in self.workspace_members if m["user_id"] == user_id]
        memberships.sort(key=lambda m: m.get("joined_at", ""))
        return memberships[0]["workspace_id"] if memberships else None

    def verify_workspace_access(self, *, user_id: str, workspace_id: str, required_role: str | None) -> dict[str, Any] | None:
        for member in self.workspace_members:
            if member["user_id"] == user_id and member["workspace_id"] == workspace_id:
                role = str(member.get("role", "member")).lower()
                if required_role and ROLE_PRIORITY.get(role, 0) < ROLE_PRIORITY.get(required_role.lower(), 0):
                    return None
                return {"workspace_id": workspace_id, "user_id": user_id, "role": role}
        return None

    def upsert_user_preferences(
        self,
        *,
        user_id: str,
        locale: str | None = None,
        coaching_enabled: bool | None = None,
        accessibility_settings: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        user = self.users_by_id[user_id]
        if locale is not None:
            user.locale = locale
        if coaching_enabled is not None:
            user.coaching_enabled = coaching_enabled
        if accessibility_settings is not None:
            # Merge into existing settings — never replace wholesale
            current = user.accessibility_settings or {}
            user.accessibility_settings = {**current, **accessibility_settings}
        return {
            "locale": user.locale,
            "coaching_enabled": user.coaching_enabled,
            "accessibility_settings": user.accessibility_settings or {},
        }

    def get_user_preferences(self, *, user_id: str) -> dict[str, Any]:
        user = self.users_by_id[user_id]
        return {
            "locale": user.locale,
            "coaching_enabled": user.coaching_enabled,
            "accessibility_settings": user.accessibility_settings or {},
        }

    def get_user_profile(self, user_id: str) -> dict[str, Any] | None:
        user = self.users_by_id.get(user_id)
        if user is None:
            return None
        username = user.email.split("@", 1)[0]
        return {
            "id": user.id,
            "email": user.email,
            "username": username,
            "display_name": user.display_name,
            "bio": user.bio,
            "timezone": user.timezone,
            "locale": user.locale,
            "coaching_enabled": user.coaching_enabled,
            "role": "member",
            "avatar_url": user.avatar_url,
        }

    def update_user_profile(
        self,
        user_id: str,
        *,
        display_name: str | None,
        bio: str | None,
        timezone: str | None,
        avatar_url: str | None,
    ) -> dict[str, Any] | None:
        user = self.users_by_id.get(user_id)
        if user is None:
            return None
        if display_name is not None:
            user.display_name = display_name.strip()
        if bio is not None:
            user.bio = bio.strip() or None
        if timezone is not None:
            user.timezone = timezone or None
        if avatar_url is not None:
            user.avatar_url = avatar_url or None
        return self.get_user_profile(user_id)

    def create_refresh_token(
        self,
        *,
        user_id: str,
        token_hash: str,
        workspace_id: str,
        expires_at_iso: str,
        device_hint: str | None,
    ) -> dict[str, Any]:
        row = {
            "id": str(uuid4()),
            "user_id": user_id,
            "token_hash": token_hash,
            "workspace_id": workspace_id,
            "issued_at": self._now().isoformat(),
            "expires_at": expires_at_iso,
            "revoked": False,
            "revoked_at": None,
            "device_hint": device_hint,
        }
        self.refresh_tokens[token_hash] = row
        return row

    def get_refresh_token(self, token_hash: str) -> dict[str, Any] | None:
        return self.refresh_tokens.get(token_hash)

    def revoke_refresh_token(self, token_hash: str) -> None:
        row = self.refresh_tokens.get(token_hash)
        if row is not None:
            row["revoked"] = True
            row["revoked_at"] = self._now().isoformat()

    def revoke_all_refresh_tokens_for_user(self, user_id: str) -> None:
        for row in self.refresh_tokens.values():
            if row["user_id"] == user_id and not row.get("revoked"):
                row["revoked"] = True
                row["revoked_at"] = self._now().isoformat()

    def rotate_refresh_token(
        self,
        *,
        old_token_hash: str,
        new_token_hash: str,
        user_id: str,
        workspace_id: str,
        expires_at_iso: str,
        device_hint: str | None,
    ) -> bool:
        old = self.refresh_tokens.get(old_token_hash)
        if old is None or old.get("revoked"):
            return False
        self.revoke_refresh_token(old_token_hash)
        self.create_refresh_token(
            user_id=user_id,
            token_hash=new_token_hash,
            workspace_id=workspace_id,
            expires_at_iso=expires_at_iso,
            device_hint=device_hint,
        )
        return True

    def list_channels(self, workspace_id: str) -> list[dict[str, Any]]:
        rows = [c for c in self.channels.values() if c["workspace_id"] == workspace_id]
        rows.sort(key=lambda c: c.get("created_at", ""))
        return rows

    def create_channel(
        self,
        *,
        workspace_id: str,
        name: str,
        description: str | None,
        tone: str,
        created_by: str,
        is_private: bool,
    ) -> dict[str, Any]:
        channel_id = str(uuid4())
        row = {
            "id": channel_id,
            "workspace_id": workspace_id,
            "name": name,
            "description": description,
            "tone": tone,
            "is_private": is_private,
            "created_by": created_by,
            "created_at": self._now().isoformat(),
        }
        self.channels[channel_id] = row
        return row

    def get_channel(self, channel_id: str) -> dict[str, Any] | None:
        return self.channels.get(channel_id)

    def _user_blob(self, user_id: str) -> dict[str, Any]:
        user = self.users_by_id.get(user_id)
        if user is None:
            return {
                "id": user_id,
                "name": "Unknown",
                "display_name": "Unknown",
                "initials": "??",
                "color": "#6b7280",
            }
        palette = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"]
        color_idx = int(sha256(user_id.encode("utf-8")).hexdigest()[:2], 16) % len(palette)
        return {
            "id": user.id,
            "name": user.display_name,
            "display_name": user.display_name,
            "initials": self._initials(user.display_name),
            "color": palette[color_idx],
        }

    def create_message(
        self,
        *,
        channel_id: str,
        user_id: str,
        workspace_id: str,
        text: str,
        text_translated: str | None,
        mesh_origin: bool,
        source_locale: str | None,
    ) -> dict[str, Any]:
        now_iso = self._now().isoformat()
        row = {
            "id": str(uuid4()),
            "channel_id": channel_id,
            "user_id": user_id,
            "workspace_id": workspace_id,
            "text": text,
            "text_translated": text_translated,
            "source_locale": source_locale,
            "sentiment_score": None,
            "mesh_origin": bool(mesh_origin),
            "deleted_at": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        self.messages[row["id"]] = row
        return row

    def get_message(self, message_id: str) -> dict[str, Any] | None:
        return self.messages.get(message_id)

    def get_message_with_relations(self, message_id: str) -> dict[str, Any] | None:
        row = self.messages.get(message_id)
        if row is None:
            return None
        related_reactions = [r for r in self.message_reactions if r["message_id"] == message_id]
        related_edits = [e for e in self.message_edits if e["message_id"] == message_id]
        return {
            **row,
            "users": self._user_blob(str(row.get("user_id", ""))),
            "message_reactions": [{"id": r["id"], "emoji": r["emoji"], "user_id": r["user_id"]} for r in related_reactions],
            "message_edits": [{"message_id": e["message_id"]} for e in related_edits],
        }

    def list_messages_page(
        self,
        *,
        channel_id: str,
        cursor_id: str | None,
        cursor_created_at: datetime | None,
        limit_plus_one: int,
    ) -> list[dict[str, Any]]:
        rows = [self.get_message_with_relations(mid) for mid, message in self.messages.items() if message["channel_id"] == channel_id]
        filtered = [row for row in rows if row is not None]

        filtered.sort(
            key=lambda row: (
                str(row.get("created_at", "")),
                str(row.get("id", "")),
            ),
            reverse=True,
        )

        if cursor_id and cursor_created_at is not None:
            cursor_iso = cursor_created_at.isoformat()
            filtered = [
                row
                for row in filtered
                if (
                    str(row.get("created_at", "")) < cursor_iso
                    or (
                        str(row.get("created_at", "")) == cursor_iso
                        and str(row.get("id", "")) < cursor_id
                    )
                )
            ]

        return filtered[: max(1, limit_plus_one)]

    def add_message_edit(self, *, message_id: str, edited_by: str, previous_text: str, new_text: str) -> None:
        self.message_edits.append(
            {
                "id": str(uuid4()),
                "message_id": message_id,
                "edited_by": edited_by,
                "previous_text": previous_text,
                "new_text": new_text,
                "edited_at": self._now().isoformat(),
            }
        )

    def update_message_text(self, *, message_id: str, new_text: str) -> None:
        row = self.messages.get(message_id)
        if row is None:
            return
        row["text"] = new_text
        row["updated_at"] = self._now().isoformat()

    def soft_delete_message(self, *, message_id: str) -> None:
        row = self.messages.get(message_id)
        if row is None:
            return
        now_iso = self._now().isoformat()
        row["deleted_at"] = now_iso
        row["updated_at"] = now_iso

    def toggle_reaction(self, *, message_id: str, user_id: str, emoji: str) -> None:
        for idx, row in enumerate(self.message_reactions):
            if row["message_id"] == message_id and row["user_id"] == user_id and row["emoji"] == emoji:
                self.message_reactions.pop(idx)
                return
        self.message_reactions.append(
            {
                "id": str(uuid4()),
                "message_id": message_id,
                "user_id": user_id,
                "emoji": emoji,
                "created_at": self._now().isoformat(),
            }
        )

    def list_reactions(self, *, message_id: str) -> list[dict[str, Any]]:
        return [{"emoji": row["emoji"], "user_id": row["user_id"]} for row in self.message_reactions if row["message_id"] == message_id]

    def get_last_n_messages(self, *, channel_id: str, n: int) -> list[dict[str, Any]]:
        rows = [row for row in self.messages.values() if row["channel_id"] == channel_id and row.get("deleted_at") is None]
        rows.sort(key=lambda row: str(row.get("created_at", "")), reverse=True)
        selected = rows[: max(1, min(n, 100))]
        selected.reverse()
        return [{"id": row["id"], "text": row["text"], "channel_id": row["channel_id"], "user_id": row["user_id"], "created_at": row["created_at"]} for row in selected]

    def list_active_channel_ids(self, *, cutoff_iso: str) -> list[str]:
        return sorted({str(row["channel_id"]) for row in self.messages.values() if str(row.get("created_at", "")) >= cutoff_iso})

    def save_pulse_snapshot(self, *, channel_id: str, score: float, label: str) -> dict[str, Any]:
        row = {
            "channel_id": channel_id,
            "score": float(score),
            "label": label,
            "updated_at": self._now().isoformat(),
        }
        self.workspaces.setdefault("__pulse__", {})
        self.workspaces["__pulse__"][channel_id] = row
        return row

    def get_pulse_snapshot(self, *, channel_id: str) -> dict[str, Any] | None:
        pulse_map = self.workspaces.get("__pulse__", {})
        value = pulse_map.get(channel_id)
        return dict(value) if isinstance(value, dict) else None

    def create_mesh_node(self, *, workspace_id: str, node_id: str, secret_hash: str) -> dict[str, Any]:
        row = {
            "id": str(uuid4()),
            "node_id": node_id,
            "secret_hash": secret_hash,
            "workspace_id": workspace_id,
            "registered_at": self._now().isoformat(),
            "last_seen": None,
            "revoked": False,
        }
        self.mesh_nodes[node_id] = row
        return row

    def list_mesh_nodes(self, *, workspace_id: str) -> list[dict[str, Any]]:
        rows = [row for row in self.mesh_nodes.values() if row["workspace_id"] == workspace_id]
        rows.sort(key=lambda row: str(row.get("registered_at", "")), reverse=True)
        return rows

    def get_mesh_node(self, node_id: str) -> dict[str, Any] | None:
        return self.mesh_nodes.get(node_id)

    def revoke_mesh_node(self, *, node_id: str, workspace_id: str) -> bool:
        row = self.mesh_nodes.get(node_id)
        if row is None or row.get("workspace_id") != workspace_id:
            return False
        row["revoked"] = True
        return True

    def update_mesh_node_last_seen(self, node_id: str) -> None:
        row = self.mesh_nodes.get(node_id)
        if row is not None:
            row["last_seen"] = self._now().isoformat()

    def sync_mesh_messages(self, *, messages: list[dict[str, Any]], workspace_id: str) -> int:
        inserted = 0
        for incoming in messages:
            channel_id = str(incoming.get("channelId") or incoming.get("channel_id") or "").strip()
            user_id = str(incoming.get("userId") or incoming.get("user_id") or "").strip()
            text = str(incoming.get("text") or "").strip()
            if not channel_id or not user_id or not text:
                continue
            message_id = str(incoming.get("id") or str(uuid4()))
            self.messages[message_id] = {
                "id": message_id,
                "channel_id": channel_id,
                "user_id": user_id,
                "workspace_id": workspace_id,
                "text": text,
                "text_translated": incoming.get("textTranslated") or incoming.get("text_translated"),
                "source_locale": incoming.get("sourceLocale") or incoming.get("source_locale"),
                "sentiment_score": incoming.get("sentimentScore") or incoming.get("sentiment_score"),
                "mesh_origin": True,
                "deleted_at": None,
                "created_at": self._now().isoformat(),
                "updated_at": self._now().isoformat(),
            }
            inserted += 1
        return inserted


local_store = LocalStore()
