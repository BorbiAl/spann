from __future__ import annotations


def test_public_runtime_config_is_accessible_without_auth(client):
    response = client.get("/config/public")
    assert response.status_code == 200

    body = response.json()
    data = body["data"]
    assert isinstance(data, dict)
    assert "app_download_url" in data
    assert "nav_items" in data
    assert "cultures" in data
    assert "feature_toggles" in data
    assert isinstance(data["nav_items"], list)
    assert isinstance(data["cultures"], list)
    assert isinstance(data["feature_toggles"], dict)
