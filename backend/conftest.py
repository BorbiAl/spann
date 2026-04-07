from __future__ import annotations

import hashlib
import hmac
import importlib
import json
import os
import secrets
import shutil
import time
from dataclasses import dataclass
from collections.abc import AsyncGenerator, Generator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import jwt
import psycopg
import pytest
import redis
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer


# Ensure early imports of app modules during test collection use test-safe defaults.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("JWT_SECRET", "this-is-a-very-long-test-secret-32bytes!!")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("REDIS_URL", os.getenv("TEST_REDIS_URL", "redis://localhost:6380/0"))
os.environ.setdefault("CELERY_BROKER_URL", os.getenv("TEST_REDIS_URL", "redis://localhost:6380/0"))
os.environ.setdefault("CELERY_RESULT_BACKEND", os.getenv("TEST_REDIS_URL", "redis://localhost:6380/1"))


@dataclass
class _StaticContainer:
    connection_url: str

    def get_connection_url(self) -> str:
        return self.connection_url


def _can_connect_postgres(dsn: str) -> bool:
    normalized_dsn = dsn.replace("postgresql+psycopg2://", "postgresql://")
    try:
        with psycopg.connect(normalized_dsn, connect_timeout=2) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
        return True
    except Exception:
        return False


def _can_connect_redis(url: str) -> bool:
    try:
        client = redis.Redis.from_url(url, decode_responses=True)
        try:
            return bool(client.ping())
        finally:
            client.close()
    except Exception:
        return False


@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresContainer, None, None]:
    explicit_dsn = os.getenv("TEST_DATABASE_URL")
    if explicit_dsn:
        yield _StaticContainer(explicit_dsn)
        return

    fallback_dsn = os.getenv("FALLBACK_TEST_DATABASE_URL", "postgresql://spann:spann@localhost:5433/spann_test")
    prefer_local = os.getenv("TEST_PREFER_LOCAL_SERVICES", "true").lower() in {"1", "true", "yes"}
    if prefer_local and _can_connect_postgres(fallback_dsn):
        yield _StaticContainer(fallback_dsn)
        return

    if shutil.which("docker-credential-desktop") is None and _can_connect_postgres(fallback_dsn):
        yield _StaticContainer(fallback_dsn)
        return

    try:
        with PostgresContainer("postgres:16-alpine", username="spann", password="spann", dbname="spann_test") as container:
            yield container
            return
    except Exception as exc:
        if _can_connect_postgres(fallback_dsn):
            yield _StaticContainer(fallback_dsn)
            return
        raise RuntimeError(
            "Failed to start Postgres testcontainer and fallback Postgres is unavailable. "
            "Set TEST_DATABASE_URL or ensure Docker credential helper is configured."
        ) from exc


@pytest.fixture(scope="session")
def redis_container() -> Generator[RedisContainer, None, None]:
    explicit_url = os.getenv("TEST_REDIS_URL")
    if explicit_url:
        yield _StaticContainer(explicit_url)
        return

    fallback_url = os.getenv("FALLBACK_TEST_REDIS_URL", "redis://localhost:6380/0")
    prefer_local = os.getenv("TEST_PREFER_LOCAL_SERVICES", "true").lower() in {"1", "true", "yes"}

    if prefer_local and _can_connect_redis(fallback_url):
        yield _StaticContainer(fallback_url)
        return

    if shutil.which("docker-credential-desktop") is None and _can_connect_redis(fallback_url):
        yield _StaticContainer(fallback_url)
        return

    try:
        with RedisContainer("valkey/valkey:8-alpine") as container:
            yield container
            return
    except Exception as exc:
        if _can_connect_redis(fallback_url):
            yield _StaticContainer(fallback_url)
            return
        # Allow tests to continue in fail-open mode when Redis is unavailable.
        yield _StaticContainer(fallback_url)


@pytest.fixture(scope="session", autouse=True)
def configure_test_environment(postgres_container: PostgresContainer, redis_container: RedisContainer) -> None:
    os.environ["SUPABASE_URL"] = "https://example.supabase.co"
    os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"
    os.environ["GROQ_API_KEY"] = "test-groq-key"
    os.environ["JWT_SECRET"] = "this-is-a-very-long-test-secret-32bytes!!"
    os.environ["REDIS_URL"] = redis_container.get_connection_url()
    os.environ["CELERY_BROKER_URL"] = redis_container.get_connection_url()
    os.environ["CELERY_RESULT_BACKEND"] = redis_container.get_connection_url().replace("/0", "/1")
    os.environ["ENV"] = "test"


@pytest.fixture(scope="session", autouse=True)
def run_migrations(postgres_container: PostgresContainer) -> None:
    migration_file = Path(__file__).resolve().parent / "migration.sql"
    sql = migration_file.read_text(encoding="utf-8")
    dsn = postgres_container.get_connection_url().replace("postgresql+psycopg2://", "postgresql://")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
        conn.commit()


@pytest.fixture(autouse=True)
def cleanup_tables(postgres_container: PostgresContainer) -> Generator[None, None, None]:
    yield
    dsn = postgres_container.get_connection_url().replace("postgresql+psycopg2://", "postgresql://")
    tables = [
        "refresh_tokens",
        "mesh_nodes",
        "message_edits",
        "pulse_snapshot_runs",
        "workspace_members",
        "messages",
        "channels",
        "carbon_logs",
        "carbon_scores",
        "mesh_messages",
        "users",
        "workspaces",
    ]
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(%s)",
                (tables,),
            )
            existing_tables = [row[0] for row in cursor.fetchall()]
            if existing_tables:
                cursor.execute(f"TRUNCATE TABLE {', '.join(existing_tables)} RESTART IDENTITY CASCADE")
        conn.commit()


@pytest.fixture(autouse=True)
def cleanup_valkey_keys() -> Generator[None, None, None]:
    yield

    # Reset in-memory fallback rate-limit windows between tests.
    try:
        from app.middleware.rate_limit import rate_limiter

        rate_limiter._fallback_windows.clear()  # type: ignore[attr-defined]
    except Exception:
        pass

    redis_url = os.getenv("TEST_REDIS_URL") or os.getenv("REDIS_URL")
    if not redis_url:
        return

    client = redis.Redis.from_url(redis_url, decode_responses=True)
    try:
        try:
            for pattern in ("rate:*", "nonce:*", "coaching:*", "dead_letter:*", "messages:*"):
                keys = client.keys(pattern)
                if keys:
                    client.delete(*keys)
        except Exception:
            pass
    finally:
        client.close()


@pytest.fixture(scope="session", autouse=True)
def register_markers() -> None:
    # marker registration for CLI usage
    pass


@pytest.fixture()
def test_app():
    import app.config as config_module
    import app.main as main_module

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(main_module)
    return main_module.app


@pytest.fixture()
def client(test_app) -> TestClient:
    return TestClient(test_app, raise_server_exceptions=False)


@pytest.fixture()
async def async_client(test_app) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as ac:
        yield ac


@pytest.fixture(autouse=True)
def mock_groq(monkeypatch):
    async def fake_chat(messages, *, task_type="translation", **kwargs):
        text = " ".join(str(item.get("content", "")) for item in messages)
        text_lower = text.lower()
        if task_type == "translation":
            phrase = ""
            for part in text.split(","):
                if part.strip().startswith("phrase="):
                    phrase = part.split("=", 1)[1].strip()
                    break
            payload = {
                "literal": f"translated: {phrase}",
                "cultural": f"cultural: {phrase}",
                "explanation": "test explanation",
            }
            return json.dumps(payload)
        if task_type == "coaching":
            if "stupid" in text_lower or "idiot" in text_lower:
                return json.dumps({"nudge": "try rephrasing", "severity": "low"})
            return "null"
        if task_type == "sentiment":
            if "great" in text_lower:
                return "0.8"
            if "terrible" in text_lower:
                return "-0.8"
            return "0.0"
        return "0.0"

    monkeypatch.setattr("app.services.groq_client.groq_client.chat", fake_chat)


@pytest.fixture()
def issue_access_token():
    secret = os.environ["JWT_SECRET"]

    def _issue(user_id: str, workspace_id: str, *, minutes: int = 15, extra: dict | None = None, token_secret: str | None = None):
        now = datetime.now(UTC)
        payload = {
            "sub": user_id,
            "workspace_id": workspace_id,
            "jti": str(uuid4()),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=minutes)).timestamp()),
        }
        if extra:
            payload.update(extra)
        return jwt.encode(payload, token_secret or secret, algorithm="HS256")

    return _issue


@pytest.fixture()
def test_workspace() -> dict[str, str]:
    return {"workspace_id": str(uuid4())}


@pytest.fixture()
def test_user(issue_access_token, test_workspace) -> dict[str, str]:
    user_id = str(uuid4())
    workspace_id = test_workspace["workspace_id"]
    return {
        "id": user_id,
        "workspace_id": workspace_id,
        "role": "member",
        "access_token": issue_access_token(user_id, workspace_id),
        "refresh_token": secrets.token_hex(64),
    }


@pytest.fixture()
def test_admin(issue_access_token, test_workspace) -> dict[str, str]:
    user_id = str(uuid4())
    workspace_id = test_workspace["workspace_id"]
    return {
        "id": user_id,
        "workspace_id": workspace_id,
        "role": "admin",
        "access_token": issue_access_token(user_id, workspace_id),
        "refresh_token": secrets.token_hex(64),
    }


@pytest.fixture()
def second_user(issue_access_token, test_workspace) -> dict[str, str]:
    user_id = str(uuid4())
    workspace_id = test_workspace["workspace_id"]
    return {
        "id": user_id,
        "workspace_id": workspace_id,
        "role": "member",
        "access_token": issue_access_token(user_id, workspace_id),
        "refresh_token": secrets.token_hex(64),
    }


@pytest.fixture()
def other_workspace_user(issue_access_token) -> dict[str, str]:
    user_id = str(uuid4())
    workspace_id = str(uuid4())
    return {
        "id": user_id,
        "workspace_id": workspace_id,
        "role": "member",
        "access_token": issue_access_token(user_id, workspace_id),
        "refresh_token": secrets.token_hex(64),
    }


@pytest.fixture()
def auth_headers(test_user: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {test_user['access_token']}"}


@pytest.fixture()
def admin_headers(test_admin: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {test_admin['access_token']}"}


@pytest.fixture()
def make_mesh_request():
    """Return callable that builds mesh auth headers and JSON body."""

    node_id = f"node-{uuid4()}"
    node_secret = secrets.token_hex(32)

    def _build(payload: dict, *, nonce: str | None = None, timestamp: int | None = None):
        body = json.dumps(payload).encode("utf-8")
        ts = str(timestamp if timestamp is not None else int(time.time()))
        nonce_value = nonce or secrets.token_hex(16)
        body_hash = hashlib.sha256(body).hexdigest()
        message = f"{node_id}:{ts}:{nonce_value}:{body_hash}"
        signature = hmac.new(node_secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        headers = {
            "Content-Type": "application/json",
            "X-Mesh-Node-ID": node_id,
            "X-Mesh-Timestamp": ts,
            "X-Mesh-Nonce": nonce_value,
            "X-Mesh-Signature": signature,
            "X-Mesh-Body-Sha256": body_hash,
        }
        return headers, body

    return _build
