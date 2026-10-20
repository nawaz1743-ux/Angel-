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
