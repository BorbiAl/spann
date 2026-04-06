"""Pytest fixtures for API router test coverage."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Return a synchronous test client for FastAPI routes."""

    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Build a valid Authorization header for protected endpoints."""

    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": "11111111-1111-4111-8111-111111111111",
            "email": "tester@example.com",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=30)).timestamp()),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return {"Authorization": f"Bearer {token}"}
