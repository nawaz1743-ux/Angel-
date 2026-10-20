# Angel Ads Cloud — extensible foundation

This folder begins the cloud side of Angel Smart Ads Manager. The design starts with Google Ads and Meta Ads (Facebook + Instagram) and uses a provider registry so later networks can be added without rewriting the Android UI.

## Important status

This is a **foundation scaffold, not a deployed 24×7 service**. It does not yet connect provider accounts, fetch live campaign data, schedule monitoring, persist approval requests, send notifications, or mutate campaigns. The API reports these capabilities honestly and fails closed. Do not describe ads as connected or optimized until those integrations are implemented and verified.

## Current endpoints

- `GET /health` — service health.
- `GET /v1/capabilities` — configured provider capability flags.
- `GET /v1/monitoring/status` — reports whether monitoring is operational (currently false).
- `POST /v1/approvals` — authenticated draft-only endpoint; it never applies a live change.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs are available at `/docs` while the service is running.

## Deployment configuration

Copy `.env.example` to deployment secrets/environment variables. Never commit real OAuth secrets, API keys, access tokens, refresh tokens, or customer data. Set a strong `ANGEL_ADS_API_KEY` in the hosting provider's secret store. HTTPS is required in production. OAuth redirect URIs must exactly match each provider's developer-console configuration.

## Required next milestones before live use

1. Deploy the service to a reliable HTTPS host and configure secrets.
2. Implement OAuth 2.0 authorization-code flow with `state`/PKCE where supported, CSRF protection, encrypted token storage, per-user account isolation, revocation, and audit logs.
3. Implement Google Ads API and Meta Marketing API adapters using official APIs and least-privilege permissions.
4. Add durable database-backed approval records, expiring approvals, idempotency, and re-check the approval immediately before each mutation. No writes on a mere suggestion or draft.
5. Add a durable scheduler/worker, provider rate-limit handling, retry/backoff, timezone-aware alerts, monitoring, and cost limits. Keep monitoring intervals within provider quotas.
6. Add conversion tracking validation and metrics normalization (qualified calls, cost per qualified call, cost per lead, conversion rate, spend, and revenue where available).
7. Test in read-only mode / sandbox first, then test approval-gated low-risk changes before enabling any production actions.

## Safety and reliability

- No provider password collection; users authorize on the provider's official page.
- Never ship provider client secrets or long-lived tokens in the Android APK.
- Treat campaign text and provider data as untrusted input.
- AI suggestions are proposals, not proof of future results. A change must be measurable and reversible where possible.
- Stop or alert on tracking failures, unusual spend, missing metrics, authentication expiry, or provider API errors.
- The user retains control of budgets and publishing; live changes require explicit, recorded approval.
