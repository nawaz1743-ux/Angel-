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


def test_campaign_analysis_is_authenticated_and_read_only(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    denied = client.post("/v1/analysis/campaign", headers={"X-Angel-Api-Key": "wrong"}, json={"provider":"google_ads", "account_ref":"demo", "impressions":100, "clicks":10, "spend":10.0})
    assert denied.status_code == 401
    response = client.post("/v1/analysis/campaign", headers={"X-Angel-Api-Key":"test-secret"}, json={
        "provider":"google_ads", "account_ref":"demo", "impressions":1000, "clicks":4,
        "spend":500, "conversion_tracking_configured":False
    })
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "user_supplied_metrics"
    assert body["live_provider_data_fetched"] is False
    assert body["campaign_changed"] is False
    assert body["analysis"]["metrics"]["click_through_rate_percent"] == 0.4
    codes = {item["code"] for item in body["analysis"]["recommendations"]}
    assert "verify_conversion_tracking" in codes
    assert "review_creative_and_targeting" in codes


def test_campaign_analysis_rejects_inconsistent_metrics(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    response = client.post("/v1/analysis/campaign", headers={"X-Angel-Api-Key":"test-secret"}, json={
        "provider":"meta_ads", "account_ref":"demo", "impressions":10, "clicks":11, "spend":20
    })
    assert response.status_code == 422


def test_campaign_analysis_rejects_fractional_counts_and_unknown_fields(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    headers = {"X-Angel-Api-Key": "test-secret"}
    fractional = client.post("/v1/analysis/campaign", headers=headers, json={
        "provider": "google_ads", "account_ref": "demo", "impressions": 100,
        "clicks": 1.5, "spend": 10.0
    })
    assert fractional.status_code == 422
    extra_field = client.post("/v1/analysis/campaign", headers=headers, json={
        "provider": "google_ads", "account_ref": "demo", "impressions": 100,
        "clicks": 10, "spend": 10.0, "execute_now": True
    })
    assert extra_field.status_code == 422


def test_campaign_analysis_rejects_conversions_greater_than_clicks(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    response = client.post("/v1/analysis/campaign", headers={"X-Angel-Api-Key": "test-secret"}, json={
        "provider": "google_ads", "account_ref": "demo", "impressions": 100,
        "clicks": 10, "spend": 20.0, "conversions": 11,
        "conversion_tracking_configured": True
    })
    assert response.status_code == 422


def test_campaign_analysis_calculates_cost_per_call_when_tracking_is_configured(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    response = client.post("/v1/analysis/campaign", headers={"X-Angel-Api-Key": "test-secret"}, json={
        "provider": "google_ads", "account_ref": "demo", "impressions": 1000,
        "clicks": 50, "spend": 250.0, "calls": 5,
        "conversion_tracking_configured": True
    })
    assert response.status_code == 200
    metrics = response.json()["analysis"]["metrics"]
    assert metrics["calls"] == 5
    assert metrics["cost_per_call"] == 50.0
    assert response.json()["campaign_changed"] is False


def test_campaign_analysis_rejects_calls_greater_than_clicks(monkeypatch):
    monkeypatch.setenv("ANGEL_ADS_API_KEY", "test-secret")
    response = client.post("/v1/analysis/campaign", headers={"X-Angel-Api-Key": "test-secret"}, json={
        "provider": "meta_ads", "account_ref": "demo", "impressions": 100,
        "clicks": 10, "spend": 20.0, "calls": 11
    })
    assert response.status_code == 422
