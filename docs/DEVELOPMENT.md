# Development Guide

Setup, testing, and deployment for Detective (curiosity OS).

**Current product status:** [STATUS.md](STATUS.md)

## Prerequisites

- Node.js **20.9+** (Next.js 16 floor)
- Bun (preferred) or npm
- Keys: Neynar, Venice (and/or OpenRouter), Postgres, Redis

## Local setup

```bash
git clone https://github.com/thisyearnofear/detective.git
cd detective && bun install
cp .env.example .env.local
bun run dev
```

### Essential env

```env
NEYNAR_API_KEY=
VENICE_API_KEY=
OPENROUTER_API_KEY=          # optional but useful
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JWT_SECRET=
CRON_SECRET=
ADMIN_SECRET=

# Offline loop (defaults: follow_up 6–12h, echo 18–36h)
# OFFLINE_EVENT_MIN_MS=
# OFFLINE_EVENT_MAX_MS=
# OFFLINE_ECHO_MIN_MS=
# OFFLINE_ECHO_MAX_MS=

# Research / agent / Storacha APIs (off by default)
RESEARCH_PLATFORM_ENABLED=false
```

## Scripts

```bash
bun run dev
bun run build
bun run type-check
bun run lint
bun run scripts/smoke-phase4.ts   # offline follow_up → echo chain
```

## Consumer flow (manual)

1. Open app, authenticate
2. **Start new investigation** (needs ≥1 person with a persona snapshot — use `/admin` bulk register or prior data)
3. Send a message, then **Step away**
4. Force delivery in staging with short `OFFLINE_*_MS`, then:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/tick
```

5. Confirm ReturnCard / `GET /api/inbox?fid=…`
6. Check metric:

```bash
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  http://localhost:3000/api/metrics/return-rate
```

## Cron

`vercel.json` schedules `/api/cron/tick` every minute. Locally curl with `CRON_SECRET`.

`tickWorld` delivers due `offline_events` and may schedule an `echo` after a `follow_up` delivery.

## Research platform

```env
RESEARCH_PLATFORM_ENABLED=true
STORACHA_ENABLED=true
# + MPP / Stellar vars as needed — see docs/STELLAR.md, docs/RESEARCH_API.md
```

Agent routes (`/api/agent/pending`, `/api/agent/reply`) and Storacha routes return **404** when the flag is off.

## Common issues

### `POST /api/cases` → 404
No eligible person with a persona snapshot. Register subjects via admin bulk register or ensure `persons` + `persona_snapshots` rows exist.

### Offline never arrives
- Cron not running / wrong secret
- Event still in the future (`scheduled_for`)
- No message exchange before leave (`no_exchange`)

### `column "kind" does not exist`
App self-migrates on DB init; restart once after pulling Phase 4.1+ so `offline_events.kind` is added.

## Deployment

Vercel for the app; optional VPS standalone via `scripts/deploy-server.sh` + PM2.

Ensure production env has `DATABASE_URL`, Redis, AI keys, `CRON_SECRET`, and that cron is enabled after deploy.
