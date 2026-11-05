"""Tests for Server-Sent Events formatting and streaming router."""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import get_settings


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/api/v2/hm-agent/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["registered_tools_count"] == 38


def test_chat_sse_stream():
    client = TestClient(app)
    # Enable test mode for headers
    get_settings().test_mode = True

    response = client.post(
        "/api/v2/hm-agent/chat",
        json={"message": "Show open requisitions"},
        headers={"Authorization": "Bearer test_token"}
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    body_text = response.text
    assert "event: message_start" in body_text
    assert "event: message_complete" in body_text
