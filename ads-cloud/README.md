# Angel Ads Cloud — extensible foundation

This folder contains the cloud API foundation for Angel Smart Ads Manager. Google Ads and Meta Ads (Facebook + Instagram) are the first planned providers; the provider registry is extensible for future networks.

## Current implemented endpoints

- `GET /health` — service health.
- `GET /v1/capabilities` — transparent provider/read/write readiness flags.
- `POST /v1/analysis/campaign` — authenticated preliminary analysis of caller-supplied normalized metrics; clearly labels data source and never changes campaigns.
- `GET /v1/monitoring/status` — reports monitoring as not operational until a scheduler and provider adapters are deployed.
- `POST /v1/approvals` — authenticated, durable draft-only proposal creation.
- `GET /v1/approvals/{approval_id}` — authenticated retrieval of a stored proposal.

The campaign analysis endpoint computes CTR/CPC and offers cautious checks for missing conversion tracking and low CTR. It does not yet fetch live Google/Meta metrics; the caller must supply the metrics, and this rule-based output is not a guarantee of calls or ROI.

Approval proposals are persisted to SQLite using `DATABASE_URL`. They remain `pending_review`; there is no approve/execute endpoint and no live ad change is applied by this foundation.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs are available at `/docs` while the service is running.

## Deployment configuration

Copy `.env.example` to the deployment environment and configure secrets there. Never commit real OAuth secrets, API keys, access tokens, refresh tokens, or customer data. Set a strong `ANGEL_ADS_API_KEY` in the hosting provider's secret store. Use HTTPS in production and a persistent encrypted database/storage setup appropriate for production. The current draft database adapter supports SQLite only and is not sufficient by itself for a multi-user production service.

## Required milestones before live use

1. Deploy the service to a reliable HTTPS host with persistent storage, secrets, logs, and health monitoring.
2. Implement provider OAuth authorization-code flows with signed state/CSRF protection, PKCE where supported, redirect URI validation, encrypted token storage, per-user account isolation, revocation, and audit logs.
3. Implement Google Ads API and Meta Marketing API adapters using official APIs and least-privilege permissions; handle developer/app review and access requirements.
4. Implement durable user-scoped approval records, expiring approvals, idempotency, and re-check approval immediately before each mutation. Do not perform writes from a suggestion or draft.
5. Add a durable scheduler/worker, provider rate-limit handling, retry/backoff, timezone-aware alerts, monitoring, and cost limits. Respect provider quotas.
6. Validate conversion tracking and normalize qualified calls, cost per qualified call, cost per lead, conversion rate, spend, and revenue where available.
7. Test read-only first, then test approval-gated low-risk changes before enabling any production actions.

## Safety and reliability

- Users authorize through each provider's official login page; Angel must never collect provider passwords.
- Never ship provider client secrets or long-lived tokens in the Android APK.
- Treat campaign text and provider data as untrusted input.
- AI suggestions are proposals, not guarantees of future results.
- Alert or pause recommendations when tracking fails, spend is anomalous, metrics are missing, authentication expires, or provider APIs fail.
- The user retains control of budgets and publishing; live changes require explicit, recorded approval.
