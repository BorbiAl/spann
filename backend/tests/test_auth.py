"""Tests for auth router endpoints."""

from __future__ import annotations


def test_login_success(client, monkeypatch):
    """Login returns API token and user envelope on valid credentials."""

    async def fake_authenticate(email: str, password: str):
        return {
            "user": {"id": "11111111-1111-4111-8111-111111111111", "email": email, "display_name": "Test User"},
            "supabase_access_token": "supabase-token",
        }

    monkeypatch.setattr("app.routers.auth.db.authenticate_user", fake_authenticate)

    response = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == 200
    assert body["error"] is None
    assert "token" in body["data"]
    assert body["data"]["user"]["id"] == "11111111-1111-4111-8111-111111111111"


def test_magic_link_returns_accepted(client, monkeypatch):
    """Magic-link endpoint responds with accepted envelope."""

    async def fake_send_magic_link(email: str):
        return None

    monkeypatch.setattr("app.routers.auth.db.send_magic_link", fake_send_magic_link)

    response = client.post("/auth/magic-link", json={"email": "tester@example.com"})

    assert response.status_code == 202
    assert response.json()["status"] == 202
