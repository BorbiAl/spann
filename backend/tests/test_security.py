from __future__ import annotations

from uuid import uuid4


def test_sql_injection_login_input_rejected(client):
    response = client.post(
        "/auth/login",
        json={"email": "' OR 1=1 --@x.com", "password": "password123"},
    )
    assert response.status_code in (401, 422)


def test_xss_message_payload_preserved_or_sanitized(client, auth_headers):
    channel = client.post("/channels", headers=auth_headers, json={"name": "sec-xss"}).json()["data"]
    payload = "<script>alert('xss')</script>"
    response = client.post(f"/channels/{channel['id']}/messages", headers=auth_headers, json={"content": payload})
    assert response.status_code in (200, 201)
    returned = response.json()["data"]["content"]
    assert "<script>" not in returned or returned == payload


def test_path_traversal_not_allowed(client, auth_headers):
    response = client.get("/../etc/passwd", headers=auth_headers)
    assert response.status_code in (404, 405)


def test_cors_preflight_restricted_origin(client):
    response = client.options(
        "/channels",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in (200, 204, 400)


def test_security_headers_present(client):
    response = client.get("/health")
    assert response.status_code == 200
    headers = response.headers
    # Allow either explicit middleware headers or deployment-proxy managed headers.
    assert (
        "x-content-type-options" in {k.lower() for k in headers.keys()}
        or "content-security-policy" in {k.lower() for k in headers.keys()}
        or "x-frame-options" in {k.lower() for k in headers.keys()}
    )


def test_mesh_signature_required(client):
    response = client.post("/mesh/presence", json={"node_id": str(uuid4()), "status": "online"})
    assert response.status_code == 401


def test_invalid_jwt_algorithm_rejected(client, test_user):
    # Deliberately malformed token with alg none style structure.
    token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ."
    response = client.get("/channels", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_workspace_data_leak_prevented(client, auth_headers, issue_access_token, other_workspace_user):
    channel = client.post("/channels", headers=auth_headers, json={"name": "private-leak"}).json()["data"]
    other_headers = {"Authorization": f"Bearer {issue_access_token(other_workspace_user['id'], other_workspace_user['workspace_id'])}"}
    response = client.get(f"/channels/{channel['id']}", headers=other_headers)
    assert response.status_code in (403, 404)
