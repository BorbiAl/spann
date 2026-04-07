from __future__ import annotations


def test_metrics_endpoint_available(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    text = response.text
    assert "process_cpu_seconds_total" in text or "http_requests_total" in text


def test_metrics_content_type_prometheus(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")


def test_metrics_records_http_requests(client, auth_headers):
    _ = client.get("/channels", headers=auth_headers)
    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "http" in metrics.text.lower()


def test_metrics_after_auth_failure(client):
    _ = client.post("/auth/login", json={"email": "bad@example.com", "password": "wrongpass"})
    metrics = client.get("/metrics")
    assert metrics.status_code == 200


def test_metrics_after_translate_call(client, auth_headers):
    _ = client.post("/translate", headers=auth_headers, json={"text": "hola", "target_language": "en"})
    metrics = client.get("/metrics")
    assert metrics.status_code == 200
