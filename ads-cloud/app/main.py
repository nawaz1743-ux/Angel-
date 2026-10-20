"""Angel Ads Cloud API foundation.

This service deliberately reports integrations as unavailable until provider OAuth,
secure token storage, and official API adapters are configured. It does not pretend
that a provider is connected or perform any live ad-account mutation.
"""
import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .providers.registry import ProviderConfig, ProviderRegistry


def _configured(*names: str) -> bool:
    return all(bool(os.getenv(name, "").strip()) for name in names)


def build_registry() -> ProviderRegistry:
    google_ready = _configured("GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN")
    meta_ready = _configured("META_APP_ID", "META_APP_SECRET")
    return ProviderRegistry([
        ProviderConfig("google_ads", "Google Ads", google_ready),
        ProviderConfig("meta_ads", "Meta Ads (Facebook + Instagram)", meta_ready),
    ])


app = FastAPI(
    title="Angel Ads Cloud API",
    version="0.1.0",
    description="Extensible cloud foundation for Angel's advertising assistant. Live provider actions are disabled until OAuth and API adapters are deployed.",
)


class MonitoringConfig(BaseModel):
    enabled: bool = False
    interval_minutes: int = Field(default=30, ge=15, le=360)
    notify_on_anomaly: bool = True


class ApprovalRequest(BaseModel):
    provider: str
    account_ref: str
    summary: str = Field(min_length=1, max_length=2000)
    proposed_change: dict = Field(default_factory=dict)
    estimated_risk: str = Field(default="medium", pattern="^(low|medium|high)$")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "angel-ads-cloud", "version": app.version}


@app.get("/v1/capabilities")
def capabilities() -> dict:
    providers = build_registry().list_capabilities()
    return {
        "platforms": [
            {"key": p.key, "name": p.display_name, "configured": p.configured,
             "supports_read": p.supports_read, "supports_drafts": p.supports_drafts,
             "supports_write": p.supports_write}
            for p in providers
        ],
        "future_platforms_supported": True,
        "live_account_connections_implemented": False,
        "live_campaign_writes_enabled": False,
        "monitoring_worker_deployed": False,
    }


@app.get("/v1/monitoring/status")
def monitoring_status() -> dict:
    return {
        "requested_enabled": os.getenv("MONITORING_ENABLED", "false").lower() == "true",
        "operational": False,
        "reason": "Cloud scheduler, durable account connections, and provider metrics adapters must be deployed before monitoring can run.",
        "default_interval_minutes": 30,
        "approval_required_for_campaign_changes": True,
    }


@app.post("/v1/approvals", status_code=202)
def create_approval_draft(request: ApprovalRequest, x_angel_api_key: str | None = Header(default=None)) -> dict:
    """Accept a draft only when an API key is configured and matches.

    Durable storage and execution are intentionally not implemented in this scaffold;
    this endpoint returns a transparent draft-only status and never changes live ads.
    """
    expected = os.getenv("ANGEL_ADS_API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Ads API is not configured by the deployment owner yet.")
    if not x_angel_api_key or x_angel_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API authorization.")
    provider = build_registry().get(request.provider)
    if provider is None:
        raise HTTPException(status_code=404, detail="Unsupported advertising platform.")
    return {
        "status": "draft_only",
        "approval_id": None,
        "provider": provider.key,
        "summary": request.summary,
        "estimated_risk": request.estimated_risk,
        "live_change_applied": False,
        "message": "Draft received. Durable approval storage and live provider execution are not implemented yet.",
    }
