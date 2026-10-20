"""Angel Ads Cloud API foundation.

Provider writes remain disabled until OAuth, encrypted token storage, live
provider adapters, and durable approval execution are implemented.
"""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr

from .providers.registry import ProviderConfig, ProviderRegistry
from .optimization import analyze_campaign


def _configured(*names: str) -> bool:
    return all(bool(os.getenv(name, "").strip()) for name in names)


def build_registry() -> ProviderRegistry:
    google_ready = _configured("GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN")
    meta_ready = _configured("META_APP_ID", "META_APP_SECRET")
    return ProviderRegistry([
        ProviderConfig("google_ads", "Google Ads", google_ready),
        ProviderConfig("meta_ads", "Meta Ads (Facebook + Instagram)", meta_ready),
    ])


def _database_path() -> str:
    configured = os.getenv("DATABASE_URL", "sqlite:///./angel_ads.db").strip()
    if not configured.startswith("sqlite:///"):
        # Non-SQLite database URLs are not silently treated as SQLite paths.
        raise RuntimeError("This build supports SQLite only; configure a supported database adapter before using DATABASE_URL.")
    return configured.removeprefix("sqlite:///")


@contextmanager
def _db():
    path = _database_path()
    if path != ":memory:":
        Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS approval_drafts (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                account_ref TEXT NOT NULL,
                summary TEXT NOT NULL,
                proposed_change_json TEXT NOT NULL,
                estimated_risk TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        connection.commit()
        yield connection
        connection.commit()
    finally:
        connection.close()


app = FastAPI(
    title="Angel Ads Cloud API",
    version="0.2.0",
    description="Extensible cloud foundation. Live provider actions remain disabled until secure integrations are deployed.",
)


class CampaignAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    provider: StrictStr
    account_ref: StrictStr = Field(min_length=1, max_length=200)
    impressions: StrictInt = Field(ge=0)
    clicks: StrictInt = Field(ge=0)
    spend: StrictFloat = Field(ge=0, le=100000000)
    conversions: StrictInt | None = Field(default=None, ge=0)
    conversion_tracking_configured: StrictBool = False

class ApprovalRequest(BaseModel):
    provider: str
    account_ref: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=2000)
    proposed_change: dict = Field(default_factory=dict)
    estimated_risk: str = Field(default="medium", pattern="^(low|medium|high)$")


def _require_api_key(supplied: str | None) -> None:
    expected = os.getenv("ANGEL_ADS_API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Ads API is not configured by the deployment owner yet.")
    if not supplied or supplied != expected:
        raise HTTPException(status_code=401, detail="Invalid API authorization.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "angel-ads-cloud", "version": app.version}


@app.get("/v1/capabilities")
def capabilities() -> dict:
    providers = build_registry().list_capabilities()
    return {
        "platforms": [
            {"key": p.key, "name": p.display_name, "configured": p.configured,
             "supports_read": False, "supports_drafts": True, "supports_write": False}
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
        "reason": "A deployed scheduler, OAuth connections, and live provider metrics adapters are not implemented yet.",
        "default_interval_minutes": 30,
        "approval_required_for_campaign_changes": True,
    }


@app.post("/v1/approvals", status_code=202)
def create_approval_draft(request: ApprovalRequest, x_angel_api_key: str | None = Header(default=None)) -> dict:
    """Persist a proposal for review. This endpoint never approves or executes it."""
    _require_api_key(x_angel_api_key)
    provider = build_registry().get(request.provider)
    if provider is None:
        raise HTTPException(status_code=404, detail="Unsupported advertising platform.")
    approval_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    with _db() as connection:
        connection.execute(
            """INSERT INTO approval_drafts
               (id, provider, account_ref, summary, proposed_change_json, estimated_risk, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?)""",
            (approval_id, provider.key, request.account_ref, request.summary,
             json.dumps(request.proposed_change), request.estimated_risk, created_at),
        )
    return {
        "status": "pending_review",
        "approval_id": approval_id,
        "provider": provider.key,
        "summary": request.summary,
        "estimated_risk": request.estimated_risk,
        "live_change_applied": False,
        "created_at": created_at,
        "message": "Proposal stored for review only. No live campaign change was applied.",
    }


@app.get("/v1/approvals/{approval_id}")
def get_approval_draft(approval_id: str, x_angel_api_key: str | None = Header(default=None)) -> dict:
    _require_api_key(x_angel_api_key)
    with _db() as connection:
        row = connection.execute("SELECT * FROM approval_drafts WHERE id = ?", (approval_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Approval draft not found.")
    return {
        "approval_id": row["id"],
        "provider": row["provider"],
        "account_ref": row["account_ref"],
        "summary": row["summary"],
        "proposed_change": json.loads(row["proposed_change_json"]),
        "estimated_risk": row["estimated_risk"],
        "status": row["status"],
        "created_at": row["created_at"],
        "live_change_applied": False,
    }


@app.post("/v1/analysis/campaign")
def analyze_campaign_metrics(
    payload: CampaignAnalysisRequest,
    x_angel_api_key: str | None = Header(default=None),
) -> dict:
    """Analyze caller-supplied normalized metrics; this endpoint never changes campaigns."""
    _require_api_key(x_angel_api_key)
    provider = build_registry().get(payload.provider)
    if provider is None:
        raise HTTPException(status_code=404, detail="Unsupported advertising platform.")
    if not payload.account_ref.strip():
        raise HTTPException(status_code=422, detail="account_ref must not be blank.")
    if payload.clicks > payload.impressions:
        raise HTTPException(status_code=422, detail="Clicks cannot exceed impressions.")
    if payload.conversions is not None and payload.conversions > payload.clicks:
        raise HTTPException(status_code=422, detail="Conversions cannot exceed clicks.")
    if not __import__("math").isfinite(payload.spend):
        raise HTTPException(status_code=422, detail="Spend must be finite.")
    metrics = {
        "impressions": payload.impressions,
        "clicks": payload.clicks,
        "spend": payload.spend,
        "conversions": payload.conversions,
        "conversion_tracking_configured": payload.conversion_tracking_configured,
    }
    return {
        "provider": provider.key,
        "account_ref": payload.account_ref,
        "analysis": analyze_campaign(metrics),
        "source": "user_supplied_metrics",
        "live_provider_data_fetched": False,
        "campaign_changed": False,
        "approval_required_for_any_live_change": True,
    }
