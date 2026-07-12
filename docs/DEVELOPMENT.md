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

## Beta seeding

Before inviting the first batch of beta users, give them subjects to investigate on their first try by seeding the durable `persons` + `persona_snapshots` tables via the existing admin bulk-register endpoint.

```bash
# 1. (one-time) edit scripts/seed-beta-persons.json — replace the
#    REPLACE_ME_builder_* placeholders with 10–15 real Farcaster usernames
#    of accounts that have ≥10 recent casts (the endpoint validates this).

# 2. Run the seeder. It auto-transitions game state to REGISTRATION, runs
#    bulk register, and rolls the state back to whatever it was before.
#    Set ADMIN_SECRET in .env.local first.
bun run seed:beta
```

The script targets `NEXT_PUBLIC_BACKEND_URL` if set, otherwise `http://localhost:3000`. Per-username outcomes print per-line (`[OK]`, `[SKIP]`) and the final summary reports `registered/total`.

**Re-runs are safe** — already-registered users are returned as `[SKIP] Already registered` and the script does not crash on partial failures.

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

## Logging in API routes

Every `try/catch` in a route file under `src/app/api/**` should route the error through `logger.error` from `src/lib/logger.ts` so that the Discord webhook (`LOG_WEBHOOK_URL`, production only) and the admin recent-errors panel (`/admin`) see it. Standard pattern:

```ts
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // ...
  } catch (error) {
    logger.error("[/api/foo GET] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

Tag the message with a stable prefix (`[/api/foo GET] handler failed` etc.) so an operator scanning the admin panel can correlate a Discord ping back to a specific route. For the not-found-as-error case (e.g. `match-not-found`), use the same `logger.error` with the matched-prefix pattern and skip the catch-block wrapper.

Do **not** use `console.error` for production failure paths — it bypasses the webhook + ring buffer. Pure `console.log` is fine for INFO / audit-only lines (e.g. the request-shape echo in `/api/match/vote`).

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
