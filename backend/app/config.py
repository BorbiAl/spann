"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
from secrets import compare_digest

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized settings for all backend services and integrations."""

    _BACKEND_ROOT = Path(__file__).resolve().parents[1]
    _REPO_ROOT = Path(__file__).resolve().parents[2]
    model_config = SettingsConfigDict(
        env_file=(str(_REPO_ROOT / ".env"), str(_BACKEND_ROOT / ".env"), ".env"),
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Spann Backend"
    env: str = "development"
    test_mode: bool = Field(default=False, alias="TEST_MODE")
    auth_fallback_enabled: bool = Field(default=False, alias="AUTH_FALLBACK_ENABLED")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    api_host: str = Field(default="127.0.0.1", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_service_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_KEY")
    supabase_use_service_role: bool = Field(default=False, alias="SUPABASE_USE_SERVICE_ROLE")

    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = "llama-3.3-70b-versatile"
    # Faster model for latency-sensitive AI features (understand, summarize).
    # llama-3.1-8b-instant averages ~400ms vs ~1.5s for 70b on Groq.
    groq_fast_model: str = Field(default="llama-3.1-8b-instant", alias="GROQ_FAST_MODEL")

    redis_url: str = Field(default="redis://valkey:6379/0", alias="REDIS_URL")

    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60
    mesh_sync_shared_token: str = Field(default="", alias="MESH_SYNC_SHARED_TOKEN")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")

    allowed_origins: str = Field(default="http://localhost:5173", alias="ALLOWED_ORIGINS")
    request_id_header: str = "X-Request-ID"

    translate_rate_limit_per_minute: int = 100
    messages_rate_limit_per_minute: int = 60
    auth_rate_limit_per_minute: int = 10
    default_public_rate_limit_per_minute: int = 300

    max_message_bytes: int = 4096
    max_message_length: int = 4096
    max_channel_name_length: int = 120

    celery_broker_url: str = Field(default="redis://valkey:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://valkey:6379/1", alias="CELERY_RESULT_BACKEND")

    next_public_api_url: str = Field(default="http://localhost:8000", alias="NEXT_PUBLIC_API_URL")
    app_download_url: str = Field(default="", alias="APP_DOWNLOAD_URL")
    public_runtime_config_json: str = Field(default="{}", alias="PUBLIC_RUNTIME_CONFIG_JSON")

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        """Block insecure production settings early at startup."""

        is_production = self.env.lower() == "production"
        if is_production and "*" in self.cors_origins:
            raise ValueError("ALLOWED_ORIGINS cannot include '*' in production")
        if is_production and self.test_mode:
            raise ValueError("TEST_MODE must be disabled in production")
        if is_production and self.auth_fallback_enabled:
            raise ValueError("AUTH_FALLBACK_ENABLED must be disabled in production")
        if is_production and len(self.jwt_secret.strip()) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters in production")
        if is_production and (not self.supabase_url.strip() or not self.supabase_api_key.strip()):
            raise ValueError("SUPABASE_URL and a usable Supabase API key are required in production")
        return self

    @property
    def cors_origins(self) -> list[str]:
        """Return CORS origins as a normalized list."""

        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def supabase_api_key(self) -> str:
        """Return backend Supabase API key.

        In development, prefer service-role automatically when present so
        server-side bootstrap writes (signup/profile/workspace creation) work
        without extra env toggles. In production, only use service role when
        explicitly enabled.
        """

        use_service_role = self.supabase_use_service_role or self.env.lower() != "production"
        if use_service_role and self.supabase_service_key:
            return self.supabase_service_key.strip()
        return self.supabase_anon_key.strip()

    def is_valid_mesh_sync_token(self, token: str | None) -> bool:
        """Constant-time comparison for mesh relay sync shared token."""

        expected = self.mesh_sync_shared_token.strip()
        candidate = (token or "").strip()
        if not expected:
            return False
        return compare_digest(candidate, expected)

    @property
    def public_runtime_config(self) -> dict[str, object]:
        """Return validated public runtime config exposed to frontend clients."""

        try:
            raw = json.loads(self.public_runtime_config_json or "{}")
        except json.JSONDecodeError:
            raw = {}

        if not isinstance(raw, dict):
            raw = {}

        payload: dict[str, object] = {
            "app_download_url": self.app_download_url.strip(),
            "nav_items": raw.get("nav_items") if isinstance(raw.get("nav_items"), list) else [],
            "cultures": raw.get("cultures") if isinstance(raw.get("cultures"), list) else [],
            "feature_toggles": raw.get("feature_toggles") if isinstance(raw.get("feature_toggles"), dict) else {},
        }
        return payload


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cache settings to avoid repeated environment parsing."""

    return Settings()


settings = get_settings()
