# Detective Architecture

Curiosity OS on Farcaster: reconstruct identity from digital residue; the world continues while the investigator is away.

For **what’s shipped vs gated**, see [STATUS.md](STATUS.md).

## System overview

```
┌─────────────────────────────────────────────────────────┐
│           FARCASTER CLIENT (Warpcast)                   │
│  Mini App — Auth → InvestigationHome → CaseInvestigation│
│             ReturnCard (unseen offline artefacts)       │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  Next.js App Router                                     │
│  /api/cases*  /api/inbox  /api/cron/tick                │
│  /api/metrics/return-rate                               │
│  /api/agent* /api/storacha*  (RESEARCH_PLATFORM_ENABLED) │
└─────────────────────────────────────────────────────────┘
         ↕                    ↕                    ↕
   ┌──────────┐        ┌────────────┐        ┌───────────┐
   │ Postgres │        │   Redis    │        │ Neynar +  │
   │ (SoT)    │        │ (hot cache)│        │ LLMs      │
   └──────────┘        └────────────┘        └───────────┘
```

## Domain model (Postgres)

| Entity | Role |
|--------|------|
| `persons` + `persona_snapshots` | Subject + cast-derived style/personality |
| `cases` | Investigator ↔ person bookmark (unique pair) |
| `artefacts` | Append-only stream (`message`, `offline_follow_up`, `offline_echo`) |
| `commitments` | Locked conclusions (legacy vote lock → durable write) |
| `investigator_memory` | Durable conversation memory mirror |
| `offline_events` | Delayed world events (`follow_up`, `echo`) |

**Case id:** `case-{investigatorFid}-{personFid}`

Repositories: `src/lib/personRepository.ts`, `src/lib/caseRepository.ts`, `src/lib/offlineEvents.ts`.  
Orchestration still centered in `src/lib/gameState.ts` (`tickWorld`); prefer extending repos over growing that file further.

## Auth flow

Auth is consolidated at `src/lib/auth.ts` and flows through a single endpoint:

- **MiniApp** path: `sdk.quickAuth.getToken()` returns a JWT issued by Farcaster's hosted service. The server fetches the corresponding ES256 public key from `https://api.farcaster.xyz/v2/auth/jwks` (with a 1-hour module-scoped cache), uses `crypto.subtle.verify` with ECDSA P-256 / SHA-256, and **mandatorily** validates the JWT's `domain` claim against the request hostname — a token for `evil.com` is rejected even if its signature is genuine.
- **Web SIWF** path: `@farcaster/auth-kit`'s `SignInButton.onSuccess` returns `{ signature, message, fid }` directly. The server parses the SIWF message string for mandatory `Domain` and `Expiration Time`, recovers the signer with viem's `recoverMessageAddress` (EIP-191 personal_sign), and binds the recovered address to the FID by checking Neynar's `verified_addresses.eth_addresses`.

Both paths converge at `POST /api/auth/quick-auth/verify`, which returns an internal 7-day HS256 session JWT. The client stores it as `localStorage["auth-token"]`; `src/lib/fetcher.ts` auto-attaches `Authorization: Bearer <token>` on every consumer call. On 401 from any non-auth-issuing endpoint, the session is cleared and `window.CustomEvent("auth:expired")` is dispatched so any mounted page can re-prompt.

All consumer routes (`/api/cases*`, `/api/inbox`) gate on `requireAuth(request)` and source the `fid` from the verified JWT — never from query string or body. The orphaned `/api/auth/farcaster/{status,initiate}` channel routes were deleted (consolidated auth flow replaces them).

## Consumer loop

1. Auth (mini-app SDK or web Auth Kit)
2. `InvestigationHome` — open/list cases + `ReturnCard`
3. `CaseInvestigation` — artefact stream; send via `/api/cases/[id]/messages`
4. **Step away** → `/api/cases/[id]/leave` schedules `follow_up` (6–12h)
5. Cron `/api/cron/tick` → `tickWorld` → `deliverDueOfflineEvents`
6. After `follow_up` delivery → schedule one `echo` (18–36h)
7. Return → inbox marks `seen_at` (feeds return-rate metric)

## Platform boundary

```
src/platform/          # research / payments — gated
  index.ts             # isResearchPlatformEnabled()
  agentAuth.ts, payments.ts, mpp.ts, stellar.ts
  storacha.ts, storageTracking.ts
```

Consumer spine must not statically import platform modules. Storacha uploads from `gameState` use dynamic import when `RESEARCH_PLATFORM_ENABLED=true`.

## Technology stack

| Layer | Technology |
|-------|------------|
| App | Next.js 16 + React 19 + TypeScript + Tailwind |
| Auth | Farcaster mini-app SDK + Auth Kit (web) |
| SoT | PostgreSQL (Neon) |
| Cache | Redis / Upstash |
| Cron | Vercel cron → `/api/cron/tick` |
| AI | Venice + OpenRouter (persona replies) |
| Identity data | Neynar |
| Optional research | Storacha, MPP/Stellar, agent APIs |

## Deployment

- **Frontend / API:** Vercel (standalone output also used for VPS deploys — see `scripts/deploy-server.sh`)
- **Cron:** `vercel.json` schedules `/api/cron/tick` every minute; protect with `CRON_SECRET`
- **Admin:** `/admin` — state tools + return-rate panel (`ADMIN_SECRET`)

## Historical note

Negotiation mode, tournament leaderboard-as-home, and cycle UI were **deleted** (Phases 0 and housekeeping). Match/vote HTTP paths and `gameState` cycle machinery may still exist for research/backend compatibility; they are not the consumer product.
