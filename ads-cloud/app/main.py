"""Angel Ads Cloud API foundation.

Provider writes remain disabled until OAuth, encrypted token storage, live
provider adapters, and durable approval execution are implemented.
"""
import json
import os
import sqlite3
import uuid
import time
from collections import defaultdict, deque
from threading import Lock
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
import httpx
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
    calls: StrictInt | None = Field(default=None, ge=0)
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


class AngelChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    role: StrictStr
    text: StrictStr = Field(max_length=12000)


class AngelChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    prompt: StrictStr = Field(min_length=1, max_length=12000)
    history: list[AngelChatMessage] = Field(default_factory=list, max_length=8)
    language: StrictStr = Field(default="hinglish", pattern="^(hinglish|english)$")


# Small per-process guardrail. Production hosting should also enforce edge rate limits.
_chat_rate_lock = Lock()
_chat_requests_by_ip: dict[str, deque[float]] = defaultdict(deque)
_CHAT_RATE_LIMIT = 20
_CHAT_RATE_WINDOW_SECONDS = 60


def _enforce_chat_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    with _chat_rate_lock:
        recent = _chat_requests_by_ip[client_ip]
        while recent and now - recent[0] >= _CHAT_RATE_WINDOW_SECONDS:
            recent.popleft()
        if len(recent) >= _CHAT_RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Angel AI request limit reached. Please wait and try again.")
        recent.append(now)


def _angel_system_instruction(language: str) -> str:
    if language == "hinglish":
        return (
            "You are Angel, a helpful, intelligent, polite and caring personal AI assistant.\n\n"
            "LANGUAGE RULES:\n"
            "- Reply in natural Hinglish using Roman letters only.\n"
            "- Never write Hindi in Devanagari script.\n"
            "- If the user writes in English, reply in natural English.\n"
            "- Address the user politely as Sir when appropriate.\n\n"
            "RESPONSE RULES:\n"
            "- Understand the user's actual question before answering.\n"
            "- Give useful, specific and accurate answers.\n"
            "- Do not repeat generic responses for unrelated questions.\n"
            "- Admit uncertainty instead of inventing facts.\n"
            "- Follow the conversation context provided to you.\n"
            "- Keep answers clear and suitable for a mobile screen.\n"
            "- Do not claim that you performed a phone action unless a tool actually performed that action."
        )
    return (
        "You are Angel, a helpful, intelligent, polite and caring personal AI assistant.\n"
        "Reply in natural English. Understand the actual question and give useful, specific answers.\n"
        "Use conversation context when relevant. Do not invent facts or claim to have performed actions you did not perform.\n"
        "Keep answers clear and suitable for a mobile screen."
    )


@app.post("/v1/angel/chat")
async def angel_chat(payload: AngelChatRequest, request: Request) -> dict:
    """Server-side Gemini proxy. The provider key stays in the hosting environment, never in the APK."""
    client_ip = request.client.host if request.client else "unknown"
    _enforce_chat_rate_limit(client_ip)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Angel AI service is not configured by the server owner yet.")

    if any(message.role not in {"user", "model"} for message in payload.history):
        raise HTTPException(status_code=422, detail="Conversation history contains an unsupported role.")
    if sum(len(message.text) for message in payload.history) > 24000:
        raise HTTPException(status_code=422, detail="Conversation history is too long.")

    contents = []
    for message in payload.history:
        if message.text.strip():
            contents.append({"role": message.role, "parts": [{"text": message.text}]})
    contents.append({"role": "user", "parts": [{"text": payload.prompt}]})

    request_body = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": _angel_system_instruction(payload.language)}]},
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }

    last_status = 502
    last_message = "The AI provider did not return a usable response."
    async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
        for model in ("gemini-3.8-flash", "gemini-3.5-flash-lite"):
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                response = await client.post(
                    endpoint,
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=request_body,
                )
            except httpx.HTTPError:
                last_status = 502
                last_message = "The AI provider could not be reached. Please try again."
                continue

            if response.is_success:
                try:
                    body = response.json()
                    candidates = body.get("candidates") or []
                    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
                    answer = "\n".join(
                        part.get("text", "") for part in parts
                        if isinstance(part, dict) and isinstance(part.get("text"), str) and part.get("text").strip()
                    ).strip()
                except (ValueError, TypeError, IndexError, AttributeError):
                    answer = ""
                if answer:
                    return {"text": answer, "model": model}
                last_status = 502
                last_message = "The AI provider returned an empty response."
                continue

            last_status = response.status_code
            try:
                error_body = response.json()
                last_message = error_body.get("error", {}).get("message", "AI provider request failed.")
            except (ValueError, AttributeError):
                last_message = "AI provider request failed."

            if response.status_code in {400, 401, 403} and "quota" not in last_message.lower() and "resource exhausted" not in last_message.lower() and response.status_code != 404:
                break
            if response.status_code not in {404, 429, 500, 502, 503, 504} and not (
                response.status_code == 403 and any(term in last_message.lower() for term in ("quota", "rate limit", "resource exhausted"))
            ):
                break

    # Avoid forwarding provider diagnostics that may contain implementation details.
    if last_status == 429 or "quota" in last_message.lower() or "resource exhausted" in last_message.lower():
        raise HTTPException(status_code=429, detail="Angel's configured Gemini models are temporarily unavailable or out of quota.")
    raise HTTPException(status_code=502, detail="Angel could not get a response from the configured AI models. Please try again later.")


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
    if payload.calls is not None and payload.calls > payload.clicks:
        raise HTTPException(status_code=422, detail="Calls cannot exceed clicks.")
    if not __import__("math").isfinite(payload.spend):
        raise HTTPException(status_code=422, detail="Spend must be finite.")
    metrics = {
        "impressions": payload.impressions,
        "clicks": payload.clicks,
        "spend": payload.spend,
        "conversions": payload.conversions,
        "calls": payload.calls,
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


# Live OAuth and campaign-reporting routes. Provider tokens remain server-side.
from .live_ads import router as live_ads_router
app.include_router(live_ads_router)
