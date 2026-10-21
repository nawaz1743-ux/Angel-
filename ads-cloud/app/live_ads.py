"""OAuth-backed read-only Google Ads and Meta campaign data.

Secrets and OAuth tokens stay on the server. Live mutations are deliberately
not exposed by this module until a provider-specific, audited execution adapter
is configured and tested.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from .main import _db, _require_api_key

router = APIRouter(prefix="/v1/ads", tags=["live ads"])


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _require_provider_config(provider: str) -> None:
    required = {
        "google_ads": ("GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_REDIRECT_URI"),
        "meta_ads": ("META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"),
    }[provider]
    if not all(_env(name) for name in required):
        raise HTTPException(status_code=503, detail=f"{provider} OAuth is not configured on the server yet.")


def _fernet() -> Fernet:
    key = _env("ANGEL_TOKEN_ENCRYPTION_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Encrypted token storage is not configured on the server.")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        raise HTTPException(status_code=503, detail="The server token-encryption key is invalid.")


def _ensure_tables() -> None:
    with _db() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS ads_oauth_states (
            state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, created_at INTEGER NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS ads_connections (
            id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_account_id TEXT NOT NULL,
            account_name TEXT NOT NULL, token_ciphertext TEXT NOT NULL, created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL, UNIQUE(provider, external_account_id)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS ads_monitor_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT, connection_id TEXT NOT NULL,
            fetched_at TEXT NOT NULL, metrics_json TEXT NOT NULL
        )""")


def _signed_state(provider: str, nonce: str, ts: int) -> str:
    secret = _env("ANGEL_ADS_API_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Ads API is not configured.")
    raw = f"{provider}:{ts}:{nonce}"
    sig = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{raw}:{sig}".encode()).decode().rstrip("=")


def _consume_state(state: str, expected_provider: str) -> None:
    try:
        raw = base64.urlsafe_b64decode(state + "=" * (-len(state) % 4)).decode()
        provider, ts_text, nonce, signature = raw.split(":", 3)
        ts = int(ts_text)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")
    secret = _env("ANGEL_ADS_API_KEY")
    expected = hmac.new(secret.encode(), f"{provider}:{ts}:{nonce}".encode(), hashlib.sha256).hexdigest() if secret else ""
    if provider != expected_provider or not hmac.compare_digest(signature, expected) or abs(int(time.time()) - ts) > 600:
        raise HTTPException(status_code=400, detail="OAuth state expired or invalid.")
    _ensure_tables()
    with _db() as db:
        row = db.execute("SELECT created_at FROM ads_oauth_states WHERE state_hash=?", (hashlib.sha256(state.encode()).hexdigest(),)).fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail="OAuth state was already used or was not initiated here.")
        db.execute("DELETE FROM ads_oauth_states WHERE state_hash=?", (hashlib.sha256(state.encode()).hexdigest(),))


def _save_state(state: str, provider: str) -> None:
    _ensure_tables()
    with _db() as db:
        db.execute("INSERT INTO ads_oauth_states(state_hash,provider,created_at) VALUES(?,?,?)",
                   (hashlib.sha256(state.encode()).hexdigest(), provider, int(time.time())))


def _authorization_url(provider: str, state: str) -> str:
    if provider == "google_ads":
        params = {
            "client_id": _env("GOOGLE_ADS_CLIENT_ID"),
            "redirect_uri": _env("GOOGLE_ADS_REDIRECT_URI"),
            "response_type": "code", "scope": "https://www.googleapis.com/auth/adwords",
            "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true", "state": state,
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    params = {
        "client_id": _env("META_APP_ID"), "redirect_uri": _env("META_REDIRECT_URI"),
        "response_type": "code", "scope": "ads_read,ads_management,business_management", "state": state,
    }
    return "https://www.facebook.com/v23.0/dialog/oauth?" + urlencode(params)


@router.get("/connect/{provider}")
def connect_provider(provider: str, x_angel_api_key: str | None = Header(default=None)):
    _require_api_key(x_angel_api_key)
    if provider not in {"google_ads", "meta_ads"}:
        raise HTTPException(status_code=404, detail="Unsupported advertising platform.")
    _require_provider_config(provider)
    nonce = secrets.token_urlsafe(32)
    state = _signed_state(provider, nonce, int(time.time()))
    _save_state(state, provider)
    return {"provider": provider, "authorization_url": _authorization_url(provider, state),
            "expires_in_seconds": 600, "message": "Open this official provider login URL. Angel never asks for your provider password."}


async def _exchange_code(provider: str, code: str) -> dict:
    if provider == "google_ads":
        data = {"code": code, "client_id": _env("GOOGLE_ADS_CLIENT_ID"),
                "client_secret": _env("GOOGLE_ADS_CLIENT_SECRET"), "redirect_uri": _env("GOOGLE_ADS_REDIRECT_URI"),
                "grant_type": "authorization_code"}
        url = "https://oauth2.googleapis.com/token"
    else:
        data = {"code": code, "client_id": _env("META_APP_ID"), "client_secret": _env("META_APP_SECRET"),
                "redirect_uri": _env("META_REDIRECT_URI")}
        url = "https://graph.facebook.com/v23.0/oauth/access_token"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, data=data)
    if not response.is_success:
        raise HTTPException(status_code=502, detail="Provider authorization failed. Check OAuth configuration and provider app access.")
    token = response.json()
    if not token.get("access_token"):
        raise HTTPException(status_code=502, detail="Provider did not return an access token.")
    if provider == "meta_ads":
        async with httpx.AsyncClient(timeout=20) as client:
            long_response = await client.get("https://graph.facebook.com/v23.0/oauth/access_token", params={
                "grant_type": "fb_exchange_token", "client_id": _env("META_APP_ID"),
                "client_secret": _env("META_APP_SECRET"), "fb_exchange_token": token["access_token"]})
        if long_response.is_success:
            token = long_response.json()
    return token


async def _discover_accounts(provider: str, token: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=25) as client:
        if provider == "google_ads":
            response = await client.get("https://googleads.googleapis.com/v19/customers:listAccessibleCustomers",
                headers={"Authorization": f"Bearer {token}", "developer-token": _env("GOOGLE_ADS_DEVELOPER_TOKEN")})
            if not response.is_success:
                raise HTTPException(status_code=502, detail="Google Ads accounts could not be listed. Verify developer-token access.")
            return [{"id": item.split("/")[-1], "name": item.split("/")[-1]} for item in response.json().get("resourceNames", [])]
        response = await client.get("https://graph.facebook.com/v23.0/me/adaccounts",
            params={"fields": "id,name,account_id", "access_token": token, "limit": 100})
    if not response.is_success:
        raise HTTPException(status_code=502, detail="Meta ad accounts could not be listed. Verify app review and granted permissions.")
    return [{"id": item["id"], "name": item.get("name") or item.get("account_id") or item["id"]}
            for item in response.json().get("data", [])]


@router.get("/callback/{provider}")
async def provider_callback(provider: str, code: str = Query(...), state: str = Query(...), error: str | None = None):
    if provider not in {"google_ads", "meta_ads"}:
        raise HTTPException(status_code=404, detail="Unsupported advertising platform.")
    if error:
        raise HTTPException(status_code=400, detail="Provider login was cancelled or denied.")
    _require_provider_config(provider)
    _consume_state(state, provider)
    token = await _exchange_code(provider, code)
    accounts = await _discover_accounts(provider, token["access_token"])
    encrypted = _fernet().encrypt(json.dumps(token).encode()).decode()
    now = datetime.now(timezone.utc).isoformat()
    _ensure_tables()
    saved = []
    with _db() as db:
        for account in accounts:
            connection_id = secrets.token_urlsafe(18)
            db.execute("""INSERT INTO ads_connections
                (id,provider,external_account_id,account_name,token_ciphertext,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(provider,external_account_id) DO UPDATE SET
                account_name=excluded.account_name, token_ciphertext=excluded.token_ciphertext, updated_at=excluded.updated_at""",
                (connection_id, provider, account["id"], account["name"], encrypted, now, now))
            row = db.execute("SELECT id FROM ads_connections WHERE provider=? AND external_account_id=?",
                             (provider, account["id"])).fetchone()
            saved.append({"connection_id": row["id"], "account_id": account["id"], "account_name": account["name"]})
    return {"provider": provider, "connected_accounts": saved,
            "message": "OAuth completed. Tokens are encrypted at rest; this response contains no tokens."}


def _get_connection(connection_id: str):
    _ensure_tables()
    with _db() as db:
        row = db.execute("SELECT * FROM ads_connections WHERE id=?", (connection_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Connected ad account not found.")
    try:
        token = json.loads(_fernet().decrypt(row["token_ciphertext"].encode()).decode())
    except (InvalidToken, ValueError, TypeError):
        raise HTTPException(status_code=503, detail="Stored provider credentials could not be decrypted.")
    return dict(row), token


@router.get("/connections")
def list_connections(x_angel_api_key: str | None = Header(default=None)):
    _require_api_key(x_angel_api_key)
    _ensure_tables()
    with _db() as db:
        rows = db.execute("SELECT id,provider,external_account_id,account_name,created_at,updated_at FROM ads_connections ORDER BY provider,account_name").fetchall()
    return {"connections": [dict(row) for row in rows]}


async def _google_campaigns(account_id: str, token: dict) -> list[dict]:
    customer_id = account_id.replace("-", "")
    query = """SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign WHERE segments.date DURING LAST_30_DAYS ORDER BY metrics.cost_micros DESC LIMIT 100"""
    headers = {"Authorization": f"Bearer {token['access_token']}",
               "developer-token": _env("GOOGLE_ADS_DEVELOPER_TOKEN"), "Content-Type": "application/json"}
    login_customer = _env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
    if login_customer:
        headers["login-customer-id"] = login_customer.replace("-", "")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"https://googleads.googleapis.com/v19/customers/{customer_id}/googleAds:searchStream",
                                     headers=headers, json={"query": query})
    if not response.is_success:
        raise HTTPException(status_code=502, detail="Google Ads campaign report failed. Verify account access and API approval.")
    batches = response.json()
    rows = []
    for batch in batches if isinstance(batches, list) else []:
        for item in batch.get("results", []):
            metrics = item.get("metrics", {})
            rows.append({"campaign_id": item.get("campaign", {}).get("id"), "name": item.get("campaign", {}).get("name"),
                         "status": item.get("campaign", {}).get("status"),
                         "daily_budget": int(item.get("campaignBudget", {}).get("amountMicros", 0)) / 1_000_000,
                         "impressions": int(metrics.get("impressions", 0)), "clicks": int(metrics.get("clicks", 0)),
                         "spend": int(metrics.get("costMicros", 0)) / 1_000_000,
                         "conversions": float(metrics.get("conversions", 0))})
    return rows


async def _meta_campaigns(account_id: str, token: dict) -> list[dict]:
    account = account_id if account_id.startswith("act_") else "act_" + account_id
    params = {"fields": "campaign_id,campaign_name,impressions,clicks,spend,actions",
              "date_preset": "last_30d", "level": "campaign", "access_token": token["access_token"], "limit": 100}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"https://graph.facebook.com/v23.0/{account}/insights", params=params)
    if not response.is_success:
        raise HTTPException(status_code=502, detail="Meta campaign insights failed. Verify permissions and account access.")
    rows = []
    for item in response.json().get("data", []):
        actions = item.get("actions", [])
        conversions = sum(float(a.get("value", 0)) for a in actions if a.get("action_type") in {"lead", "purchase", "offsite_conversion"})
        rows.append({"campaign_id": item.get("campaign_id"), "name": item.get("campaign_name"),
                     "impressions": int(item.get("impressions", 0)), "clicks": int(item.get("clicks", 0)),
                     "spend": float(item.get("spend", 0)), "conversions": conversions})
    return rows


@router.get("/connections/{connection_id}/campaigns")
async def live_campaigns(connection_id: str, x_angel_api_key: str | None = Header(default=None)):
    _require_api_key(x_angel_api_key)
    row, token = _get_connection(connection_id)
    if row["provider"] == "google_ads":
        campaigns = await _google_campaigns(row["external_account_id"], token)
    else:
        campaigns = await _meta_campaigns(row["external_account_id"], token)
    now = datetime.now(timezone.utc).isoformat()
    _ensure_tables()
    with _db() as db:
        db.execute("INSERT INTO ads_monitor_snapshots(connection_id,fetched_at,metrics_json) VALUES(?,?,?)",
                   (connection_id, now, json.dumps(campaigns)))
    return {"provider": row["provider"], "account_id": row["external_account_id"], "account_name": row["account_name"],
            "source": "live_provider_api", "period": "last_30_days", "fetched_at": now, "campaigns": campaigns}


class ApprovalDecision(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    confirmation_text: str = Field(min_length=1, max_length=100)


@router.get("/monitoring/latest")
def latest_monitoring(x_angel_api_key: str | None = Header(default=None)):
    _require_api_key(x_angel_api_key)
    _ensure_tables()
    with _db() as db:
        rows = db.execute("""SELECT s.connection_id,s.fetched_at,s.metrics_json,c.provider,c.account_name
            FROM ads_monitor_snapshots s JOIN ads_connections c ON c.id=s.connection_id
            WHERE s.id IN (SELECT MAX(id) FROM ads_monitor_snapshots GROUP BY connection_id)
            ORDER BY s.fetched_at DESC""").fetchall()
    return {"operational": bool(rows), "monitoring_mode": "on-demand snapshot",
            "automated_background_monitoring": False,
            "snapshots": [{"connection_id": r["connection_id"], "provider": r["provider"],
                           "account_name": r["account_name"], "fetched_at": r["fetched_at"],
                           "campaigns": json.loads(r["metrics_json"])} for r in rows]}


@router.post("/approvals/{approval_id}/decision")
def decide_approval(approval_id: str, payload: ApprovalDecision,
                    x_angel_api_key: str | None = Header(default=None)):
    """Record an explicit human decision; approval alone never executes a mutation."""
    _require_api_key(x_angel_api_key)
    if payload.confirmation_text.strip().lower() != ("approve " + approval_id).lower() and payload.decision == "approve":
        raise HTTPException(status_code=422, detail="To approve, confirmation_text must exactly be 'approve <approval_id>'.")
    _ensure_tables()
    with _db() as db:
        row = db.execute("SELECT * FROM approval_drafts WHERE id=?", (approval_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Approval proposal not found.")
        if row["status"] != "pending_review":
            raise HTTPException(status_code=409, detail="This proposal already has a decision.")
        status = "approved_not_executed" if payload.decision == "approve" else "rejected"
        db.execute("UPDATE approval_drafts SET status=? WHERE id=?", (status, approval_id))
    return {"approval_id": approval_id, "status": status, "live_change_applied": False,
            "message": "Decision recorded. Live publishing is intentionally not enabled until audited provider-specific mutation adapters are deployed."}
