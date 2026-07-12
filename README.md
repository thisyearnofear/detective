# Detective

Farcaster mini-app: investigate people through their digital residue. Step away — the world keeps moving.

> **Pre-beta engineering hardening complete.** See [**docs/HARDENING_PLAN.md**](docs/HARDENING_PLAN.md) for the full audit. Below: the consumer product; above: the engineering readiness.

> **Pickup / roadmap:** see **[docs/STATUS.md](docs/STATUS.md)** — phases done, north-star metric, what we’re waiting on, gated next steps.

## Product (consumer)

Open a **case** on a person (persona built from Farcaster casts), ask questions, then **step away**. Cron delivers offline follow-ups (and a longer-cadence **echo**) while you’re gone. Return to open unseen clues.

This replaced the old timed Turing tournament (chat → Human/Bot vote → score → wipe).

**North-star:** % of delivered offline events whose artefact is opened within 48h (`/api/metrics/return-rate`, also on `/admin`).

## Quick Start

```bash
git clone https://github.com/thisyearnofear/detective.git
cd detective && bun install   # or npm install
cp .env.example .env.local
bun run dev
```

Required env in production: `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `NEYNAR_API_KEY`, plus one of `VENICE_API_KEY` / `OPENROUTER_API_KEY`. Optional but recommended: `ADMIN_SECRET` (admin dashboard bearer), `LOG_WEBHOOK_URL` (Discord webhook URL for prod error-level logs), `APP_URL` (production domain — set this to enable Farcaster push notifications when offline clues are delivered).

Pre-beta unboxing once code is deployed: `bun run db:migrate` then swap `REPLACE_ME_*` placeholders in `scripts/seed-beta-persons.json` to 10–15 real Farcaster accounts and `bun run seed:beta`.

See [Development Guide](docs/DEVELOPMENT.md) for setup, env vars, cron, smoke tests, and the case/offline loop.

## Documentation

| Doc | Covers |
|-----|--------|
| [**Status & roadmap**](docs/STATUS.md) | **Start here for current truth** — done / waiting / gated Phase 4+ |
| [**Architecture**](docs/ARCHITECTURE.md) | Domain model, consumer APIs, platform boundary |
| [**Development**](docs/DEVELOPMENT.md) | Local setup, cron, smoke tests, deployment |
| [**Research API**](docs/RESEARCH_API.md) | Agent/research surface (requires `RESEARCH_PLATFORM_ENABLED=true`) |
| [**Smart Contracts**](docs/SMART_CONTRACTS.md) | On-chain registration / payments (legacy + research) |
| [**Stellar / MPP**](docs/STELLAR.md) | Agent micropayments (platform) |

## Tech Stack

- **App:** Next.js 16 + React 19 + TypeScript + Tailwind
- **Auth:** Farcaster Quick Auth / mini-app SDK
- **State:** PostgreSQL (Neon) source of truth; Redis (Upstash) hot cache
- **World clock:** Vercel cron → `/api/cron/tick` → `tickWorld`
- **AI:** Venice / OpenRouter (persona-grounded replies)
- **Research platform (optional):** `src/platform/` — Storacha, MPP/Stellar, agent APIs

## Consumer API (primary)

| Method | Path | Role |
|--------|------|------|
| GET/POST | `/api/cases` | List / open investigation |
| GET | `/api/cases/[id]` | Case + artefacts + person |
| POST | `/api/cases/[id]/messages` | Message + persona reply |
| POST | `/api/cases/[id]/leave` | Schedule offline follow-up |
| GET/POST | `/api/inbox` | Unseen offline clues / mark seen |
| GET | `/api/metrics/return-rate` | North-star (admin/cron auth) |
| GET | `/api/cron/tick` | Deliver due offline events |
| POST | `/api/webhooks/farcaster` | Mini-app lifecycle events (notification tokens) |

## Research platform

Agent benchmarking, Storacha provenance, and MPP payments live under `src/platform/` and related `/api/agent/*`, `/api/storacha/*` routes.

```bash
RESEARCH_PLATFORM_ENABLED=true
```

Without that flag, research routes return 404. See [Research API](docs/RESEARCH_API.md).

## License

MIT — see [LICENSE.md](LICENSE.md)
