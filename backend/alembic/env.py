from __future__ import annotations

import os
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _normalize_database_url(raw_url: str) -> str:
    """Normalize DATABASE_URL to an SQLAlchemy psycopg2 URL."""

    url = raw_url.strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


def _resolve_database_url() -> str:
    """Resolve migration DB URL from env first, then .env files."""

    for key in (
        "SUPABASE_TRANSACTION_POOLER_URL",
        "SUPABASE_DB_URL",
        "DATABASE_URL",
    ):
        env_url = os.getenv(key)
        if env_url:
            return _normalize_database_url(env_url)

    # Fallback: parse local .env files used in this repository.
    repo_root = Path(__file__).resolve().parents[2]
    backend_root = Path(__file__).resolve().parents[1]
    candidates = [backend_root / ".env", repo_root / ".env", repo_root.parent / ".env"]
    for env_file in candidates:
        if not env_file.exists():
            continue
        discovered: dict[str, str] = {}
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            normalized_key = key.strip()
            if normalized_key not in {
                "SUPABASE_TRANSACTION_POOLER_URL",
                "SUPABASE_DB_URL",
                "DATABASE_URL",
            }:
                continue

            cleaned = value.strip().strip('"').strip("'")
            if cleaned:
                discovered[normalized_key] = cleaned

        for key in (
            "SUPABASE_TRANSACTION_POOLER_URL",
            "SUPABASE_DB_URL",
            "DATABASE_URL",
        ):
            selected = discovered.get(key)
            if selected:
                return _normalize_database_url(selected)

    raise RuntimeError(
        "SUPABASE_TRANSACTION_POOLER_URL, SUPABASE_DB_URL, or DATABASE_URL "
        "is required for Alembic migrations. "
        "Set it in your environment or .env file."
    )


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""

    url = _resolve_database_url()
    context.configure(
        url=url,
        target_metadata=None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = _resolve_database_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=None,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
