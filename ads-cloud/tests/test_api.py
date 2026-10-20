import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_service():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_capabilities_are_transparent_and_extensible():
    response = client.get("/v1/capabilities")
    assert response.status_code == 200
    body = response.json()
    assert body["future_platforms_supported"] is True
    assert body["live_account_connections_implemented"] is False
    assert body["live_campaign_writes_enabled"] is False
    assert {p["key"] for p in body["platforms"]} == {"google_ads", "meta_ads"}
    assert all(p["supports_read"] is False for p in body["platforms"])


def test_monitoring_does_not_claim_to_be_live():
    response = client.get("/v1/monitoring/status")
    assert response.status_code == 200
    assert response.json()["operational"] is False
    assert response.json()["approval_required_for_campaign_changes"] is True


def test_draft_endpoint_fails_closed_without_secret(monkeypatch):
    monkeypatch.delenv("ANGEL_ADS_API_KEY", raising=False)
    response = client.post("/v1/approvals", json={
        "provider": "google_ads", "account_ref": "demo", "summary": "Review keywords",
        "proposed_change": {"type": "keyword_review"}, "estimated_risk": "low"
    })
    assert response.status_code == 503


def test_draft_requires_valid_api_key(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    response = client.post("/v1/approvals", headers={"X-Angel-Api-Key": "wrong"}, json={
        "provider": "google_ads", "account_ref": "demo", "summary": "Review keywords",
        "proposed_change": {"type": "keyword_review"}, "estimated_risk": "low"
    })
    assert response.status_code == 401


def test_draft_is_persisted_but_never_applied(monkeypatch, tmp_path):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(tmp_path / "test.db"))
    response = client.post("/v1/approvals", headers={"X-Angel-Api-Key": "test-secret"}, json={
        "provider": "google_ads", "account_ref": "demo", "summary": "Review keywords",
        "proposed_change": {"type": "keyword_review"}, "estimated_risk": "low"
    })
    assert response.status_code == 202
    created = response.json()
    assert created["status"] == "pending_review"
    assert created["live_change_applied"] is False
    detail = client.get(
        "/v1/approvals/" + created["approval_id"],
        headers={"X-Angel-Api-Key": "test-secret"},
    )
    assert detail.status_code == 200
    assert detail.json()["proposed_change"] == {"type": "keyword_review"}
    assert detail.json()["status"] == "pending_review"
    assert detail.json()["live_change_applied"] is False


def test_unknown_provider_rejected(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    response = client.post("/v1/approvals", headers={"X-Angel-Api-Key": "test-secret"}, json={
        "provider": "unknown", "account_ref": "demo", "summary": "Review",
        "proposed_change": {}, "estimated_risk": "low"
    })
    assert response.status_code == 404
