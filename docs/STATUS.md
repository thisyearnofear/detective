# Detective — Status & Roadmap (Curiosity OS)

**Last updated:** 2026-07-11  
**HEAD at write-up:** `953ac91` (Phase 4.1 echo) on `master`

This is the pickup document. Product thesis and sequencing live here; older “Turing tournament” docs are historical for research/platform code only.

---

## Thesis

The old container (timed cycles → Human/Bot vote → score → wipe) extinguished curiosity. The identity spine is healthy: Neynar casts → persona → replies → memory.

**v2 product:** a curiosity OS — open a case on a person, investigate through digital residue, step away; the world continues and may leave a clue.

**North-star metric:** among cases where an offline event was *delivered*, what % have the payload artefact *seen* within 48h?

```
GET /api/metrics/return-rate
Authorization: Bearer $ADMIN_SECRET   # or CRON_SECRET
```

Also shown on `/admin` as **Return rate (48h)**.

If that rate does not move with real leavers, do **not** add content richness (push, evolving personas, cross-person graphs). The loop is wrong.

---

## Done

| Phase | Commit (approx) | What |
|-------|-----------------|------|
| **0** | `bdfaa25` | Deleted negotiation / dead caches / tournament chrome; restored chat slice; cron → `/api/cron/tick` |
| **1** | `7b92f0b` | Durable Postgres domain: persons, persona_snapshots, cases, artefacts, commitments, investigator memory |
| **2** | `f92b3ab` | One offline follow-up (6–12h), ReturnCard, `/api/inbox`, return-rate metric |
| **3** | `0c5b83d` | Consumer UX = cases (`InvestigationHome` / `CaseInvestigation`); tournament UI off primary path |
| **Housekeeping** | `9db9230`, `8333079` | Next.js 16 + React 19; deleted leftover game chrome; research/payments under `src/platform/` |
| **4.1** | `953ac91` | Second offline event (`echo`, 18–36h) chained after first delivery; cap 2 events/case |
| **Pre-beta hardening** | (this batch) | Phase 0+0.5 (requireAuth + real QuickAuth/SIWF signature verification), Phase 1 (env validation + DDL extraction), Phase 2 (Discord-webhook logger + admin ring buffer), Phase 3 (`.github/workflows/ci.yml`), Phase 4 (CSP/HSTS/Permissions-Policy), Phase 5 (`bun run seed:beta`), orphan-route cleanup, 401 handler. See `docs/HARDENING_PLAN.md` for the engineering audit. |

### Consumer spine (always on)

```
Auth → InvestigationHome (+ ReturnCard)
     → CaseInvestigation (artefacts)
     → leave → schedule follow_up
     → cron tickWorld → deliver → maybe schedule echo
     → inbox / ReturnCard → mark seen
```

Key routes: `/api/cases`, `/api/cases/[id]/messages`, `/api/cases/[id]/leave`, `/api/inbox`, `/api/metrics/return-rate`, `/api/cron/tick`.

### Research platform (gated)

Code lives in `src/platform/` (MPP, Stellar, Storacha, agent auth/payments).  
Enable with `RESEARCH_PLATFORM_ENABLED=true`. Agent/Storacha APIs return 404 when off.

---

## Waiting on (not blocked on a chat reply)

**From humans in chat:** nothing required to “continue planning.”

**From production usage:** return-rate among eligible leavers (exchange ≥1 message → leave → offline delivered → open clue within ~48h).

Operational checklist before judging the metric:

1. Deploy includes the pre-beta hardening batch (`+` 953ac91)
2. **Required env in production:** `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `NEYNAR_API_KEY`, plus one of `VENICE_API_KEY` / `OPENROUTER_API_KEY`. Missing any one of the first four fails the boot.
3. **Optional env:** `ADMIN_SECRET` (admin bearer), `LOG_WEBHOOK_URL` (Discord webhook for prod error-level logs — set this before inviting users).
4. **Pre-unboxing seed:** `bun run db:migrate` then `bun run seed:beta` (after swapping the `REPLACE_ME_*` placeholders in `scripts/seed-beta-persons.json` to 10–15 real Farcaster accounts that have ≥10 recent casts).
5. Vercel cron hits `/api/cron/tick` every minute (`CRON_SECRET`)
6. Postgres migrations applied (incl. `offline_events.kind`)
7. At least one person with a `persona_snapshots` row — either from `seed:beta` or prior data — so `POST /api/cases` can open subjects
8. Watch `/admin` return-rate + recent-errors panels after real loops (or short delays in staging — see env below)

---

## Next (gated, pick one at a time)

| # | Work | When |
|---|------|------|
| **4.2** | Push surface (Farcaster / web push) as amplifier of the proven loop | Only if return-rate is meaningful |
| **4.3** | Append-only persona snapshots over time (person visibly continues) | After loop retention is solid |
| **4.4** | Light cross-person reference | Only after single-case retention is solid |

**Forbidden without a new thesis:** world sim, photo gen, social graph, vector DB, evidence boards, multi-agent towns.

---

## Offline loop (current behavior)

1. Investigator leaves a case with ≥1 message → schedule `follow_up` in **6–12h**
2. `tickWorld` delivers → artefact `offline_follow_up` → ReturnCard
3. After delivery → schedule at most one `echo` in **18–36h** → artefact `offline_echo`
4. Cap: **2 events per case**, one pending at a time, one of each kind

### Env (testing / staging)

```bash
# First event (defaults 6h–12h)
OFFLINE_EVENT_MIN_MS=60000
OFFLINE_EVENT_MAX_MS=120000

# Second echo (defaults 18h–36h)
OFFLINE_ECHO_MIN_MS=120000
OFFLINE_ECHO_MAX_MS=180000

RESEARCH_PLATFORM_ENABLED=false   # consumer does not need this
```

Smoke: `bun run scripts/smoke-phase4.ts`

---

## Principles (still binding)

- Enhancement first; consolidation (delete, don’t deprecate)
- Prevent bloat; prove wedge before widening
- Postgres = source of truth for Person/Case/Artefact/OfflineEvent; Redis = hot cache
- Consumer must not statically import `src/platform/` (dynamic import only when flag on)

---

## Module surface (post-beta consolidation)

`src/lib/` is now lean — 39 files, every one actively consumed by either a route under `src/app/api/**`, a component, or another lib. Three previously-shipped utility layers were deleted in Phase 6+ because no caller imported them (verified by repo-wide grep at deletion time):

| Removed | Was | Recoverable via |
|---|---|---|
| `src/lib/mobile.ts` | Touch gestures, haptics, virtual-keyboard, pull-to-refresh, lazy image, postMessage, network-type, safe-area hooks (8 exports, 0 callers) | `git log -- src/lib/mobile.ts` |
| `src/lib/performance.ts` | Debounce/throttle, regex cache, emoji hook, intersection observer, adaptive polling, scroll handler, frame-rate, memory guard, battery hook (12 exports, 0 callers) | `git log -- src/lib/performance.ts` |
| `src/lib/viewport.ts` | `useViewport`, `responsive`, `farcaster` helpers, breakpoints (single-caller: `mobile.ts`, now gone) | `git log -- src/lib/viewport.ts` |

If a future feature legitimately needs one of those hooks, copy it back from git history rather than maintaining it pre-emptively. The decision rule going forward: a hook lives until something calls it; the dead-code purge is a periodic pass, not a one-time event.

A separate, larger cleanup — selective migration of the ~313 raw `console.log` / `console.warn` calls in `src/**` to `logger` / `logger.error` — is intentionally deferred. The Phase 2 logger already covers the two critical silent-failure paths (`worldClock.deliverDueOfflineEvents`, `generateBotResponse`); a blanket 313-site migration is too risky for one PR.**

---

## Resume prompt (for a future session)

> Read `docs/STATUS.md`. Check `/admin` return-rate and recent offline_events. If the north-star looks meaningful, implement Phase 4.2 (push). If not, diagnose the leave → deliver → return path before adding features.
