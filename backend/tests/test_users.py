"""Tests for user preference endpoint."""

from __future__ import annotations


def test_patch_preferences(client, auth_headers, monkeypatch):
    """Preferences patch endpoint returns updated settings."""

    async def fake_update_preferences(**kwargs):
        return {
            "locale": kwargs.get("locale") or "en-US",
            "coaching_enabled": kwargs.get("coaching_enabled", True),
            "accessibility_settings": kwargs.get("accessibility_settings") or {"contrast": "high"},
        }

    monkeypatch.setattr("app.routers.users.db.update_user_preferences", fake_update_preferences)

    response = client.patch(
        "/users/me/preferences",
        headers=auth_headers,
        json={"locale": "en-GB", "coaching_enabled": False, "accessibility_settings": {"fontScale": 1.2}},
    )

    assert response.status_code == 200
    assert response.json()["data"]["locale"] == "en-GB"
