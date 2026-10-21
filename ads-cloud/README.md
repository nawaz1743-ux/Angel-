# Angel Ads Cloud — live integration foundation

This service provides the server-side API for Angel Smart Ads Manager. Provider passwords are never collected by Angel; OAuth takes place on the official Google or Meta login pages. Provider tokens are encrypted at rest and never returned to Android.

## Endpoints

- `GET /health` — service health.
- `GET /v1/capabilities` — reports configured integrations and write availability.
- `GET /v1/ads/connect/google_ads` — authenticated; returns the official Google OAuth URL.
- `GET /v1/ads/connect/meta_ads` — authenticated; returns the official Meta OAuth URL.
- `GET /v1/ads/callback/{provider}` — OAuth redirect callback; discovers and stores accounts.
- `GET /v1/ads/connections` — authenticated connected-account list.
- `GET /v1/ads/connections/{connection_id}/campaigns` — authenticated live campaign metrics for the last 30 days.
- `GET /v1/ads/monitoring/latest` — latest snapshots and monitoring mode.
- `POST /v1/approvals` and `GET /v1/approvals/{approval_id}` — store and retrieve a proposal.
- `POST /v1/ads/approvals/{approval_id}/decision` — records an explicit approve/reject decision. Approval does not yet execute provider mutations.
- `POST /v1/analysis/campaign` — analyzes supplied metrics only; it does not fetch provider data or change campaigns.
- `POST /v1/angel/chat` — server-side Gemini proxy.

## Required hosting configuration

Set these as hosting secrets/environment variables; never commit them:
- `ANGEL_ADS_API_KEY`: strong random secret used by the Android-to-cloud Ads API.
- `ANGEL_TOKEN_ENCRYPTION_KEY`: Fernet key (generate with Python `Fernet.generate_key()`); losing it makes stored tokens unreadable.
- `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REDIRECT_URI`; optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
- `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`.
- `GEMINI_API_KEY` for Angel chat.
- `MONITORING_ENABLED=true` to enable the in-process polling worker; optional `MONITORING_INTERVAL_SECONDS=1800`.
- `DATABASE_URL=sqlite:///./angel_ads.db` for development only. Production needs durable persistent storage and a single scheduler worker; local ephemeral files are not suitable.

Register the exact callback URLs in Google Cloud Console and Meta for Developers. Google Ads access requires a valid developer token and appropriate API access. Meta permissions may require App Review/business verification. Provider account discovery can fail until those approvals are granted.

## Important current limitations

- The backend now contains OAuth flows, encrypted token storage, and live read-only campaign-reporting adapters. They cannot work until deployed with valid credentials and the user completes the official OAuth flow.
- The Android Smart Ads screen is not yet wired to these OAuth and campaign endpoints, so in-app connection buttons and account/campaign display still need implementation.
- Monitoring snapshots run only when `MONITORING_ENABLED=true` and the service process is running. For reliable 24/7 monitoring, deploy a dedicated single worker with persistent storage and alert delivery.
- Approval decisions are persisted, but live campaign mutations/publishing are **not enabled yet**. Provider-specific mutation adapters, an immutable audit trail, idempotency, and a second approval check immediately before writes must be completed and tested before enabling changes.
- No campaign is changed by OAuth, reads, monitoring, drafts, or the approval-decision endpoint.

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Do not use production customer data in local development. Keep secrets and tokens out of logs and Git.
