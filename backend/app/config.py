"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized settings for all backend services and integrations."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Spann Backend"
    env: str = "development"
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_anon_key: str = Field(alias="SUPABASE_ANON_KEY")
    supabase_service_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_KEY")

    groq_api_key: str = Field(alias="GROQ_API_KEY")
    groq_model: str = "llama-3.1-70b-versatile"

    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60

    allowed_origins: str = Field(default="http://localhost:5173", alias="ALLOWED_ORIGINS")
    request_id_header: str = "X-Request-ID"

    translate_rate_limit_per_minute: int = 100
    messages_rate_limit_per_minute: int = 1000
    default_public_rate_limit_per_minute: int = 300

    max_message_bytes: int = 4096
    max_message_length: int = 2000
    max_channel_name_length: int = 120

    celery_broker_url: str = Field(default="redis://redis:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://redis:6379/1", alias="CELERY_RESULT_BACKEND")

    next_public_api_url: str = Field(default="http://localhost:8000", alias="NEXT_PUBLIC_API_URL")

    @property
    def cors_origins(self) -> list[str]:
        """Return CORS origins as a normalized list."""

        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def supabase_api_key(self) -> str:
        """Return service role key when available, otherwise fall back to publishable key."""

        return (self.supabase_service_key or self.supabase_anon_key).strip()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cache settings to avoid repeated environment parsing."""

    return Settings()


settings = get_settings()
