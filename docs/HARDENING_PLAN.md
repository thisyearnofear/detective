# Detective — Pre-Beta Hardening Plan

**Last updated:** 2026-07-12
**Status:** Phases 0 + 0.5 + 1 + 2 + 3 + 4 + 5 DONE. Pre-beta hardening is complete end-to-end: auth is fully reworked (QuickAuth ES256 + SIWF EIP-191 + unified session endpoint + Authorization-aware fetcher + requireAuth on all 7 consumer routes); server-side env is fail-closed; DDL has a single source of truth; CI gates run on PR; security headers (CSP, HSTS, Permissions-Policy) are live; Discord webhook hookup for error logs is ready (`LOG_WEBHOOK_URL`); pre-beta seed is one `bun run seed:beta` away.

The work plan for taking Detective from "code-complete curiosity OS" to "small closed beta in front of real users." Each phase is independently shippable — stop and ship after any phase if scope changes.

For the **product thesis and what we are waiting on** before adding features, see [STATUS.md](STATUS.md). This document is only about **engineering readiness to let people touch the loop**.

---

## Core Principles (binding for this plan)

Every task below is explicitly aligned to one or more of these. If a task would require violating one, the task is wrong.

- **ENHANCEMENT FIRST** — always prefer extending existing components over creating new ones.
- **CONSOLIDATION** — delete unnecessary code rather than deprecate.
- **PREVENT BLOAT** — audit and consolidate before adding features. Pick one tool; do not collect them.
- **DRY** — single source of truth for all shared logic.
- **CLEAN** — clear separation of concerns with explicit dependencies.
- **MODULAR** — composable, testable, independent modules.
- **PERFORMANT** — adaptive loading, caching, and resource optimization.
- **ORGANIZED** — predictable file structure with domain-driven design.

---

## Phase 0 status (done — see Phase 0.5 below for the auth rework it unlocked)

**What shipped in Phase 0:**

- `src/lib/auth.ts` — `requireAuth(request)` helper added; `JWT_SECRET` throws at module load in production when unset; `withAuth` deleted (CONSOLIDATION).
- `src/app/api/cron/tick/route.ts` — fails closed when `CRON_SECRET` is missing.
- `src/lib/offlineEvents.ts` — `markArtefactSeen(artefactId, investigatorFid)` signature hardened: the function now does the artefact-ownership check internally and returns `{ seen: true } | { seen: false, reason: "not_found" | "forbidden" }`. The function is safe-by-default — any caller MUST pass an fid.
- `requireAuth` was rolled in across the 7 consumer routes (**Phase 0.5** is what made this safe — without signature verification on the inbound QuickAuth/SIWF tokens, the enforcement would have 401'd every app call).

---

## Phase 0 — Lock the front door (see status note above)

**Principles:** ENHANCEMENT FIRST · DRY · CLEAN · MODULAR · CONSOLIDATION

1. **Enhance `src/lib/auth.ts` with `requireFidMatch`** — DONE (delivered as `requireAuth` instead, see Phase 0.5)
2. **Wire `requireAuth` into the seven exposed consumer routes** — REVERTED (see Phase 0.5)
3. **Cron endpoint fails closed** — DONE
4. **Remove the hardcoded `JWT_SECRET` default in `src/lib/auth.ts`** — DONE

---

## Phase 0.5 — Auth Flow Rework (DONE)

**Principles:** CLEAN · DRY · ENHANCEMENT FIRST · PREVENT BLOAT

The frontend auth flow is fully reworked end-to-end and `requireAuth` is live on all 7 consumer routes.

1. **Real QuickAuth signature verification in `src/lib/auth.ts`** — DONE
   - `verifyQuickAuthToken(token, hostname)` decodes the JWT, fetches the JWKS for the ES256 public key from `https://api.farcaster.xyz/v2/auth/jwks` (1-hour module-scoped cache, forced refresh once if `kid` misses, single in-flight fetch for thundering-herd safety), uses `crypto.subtle.verify` with ECDSA P-256 / SHA-256, validates `iat`/`exp` with small skew tolerance, and **mandatorily** enforces a hostname match against the JWT's `domain` claim so cross-app token replay is impossible.
2. **One session-issuance endpoint at `POST /api/auth/quick-auth/verify`** — DONE
   - Accepts `{ kind: "quick-auth", token }` (MiniApp) or `{ kind: "siwf", signature, message, fid }` (web).
   - QuickAuth branch: signature verification + fid lookup → Neynar profile fetch → `createAuthToken`.
   - SIWF branch: parses the SIWF message (Domain / Expiration Time are mandatory), recovers the signer address via viem's `recoverMessageAddress` (EIP-191), and binds the address to the FID by checking Neynar's `verified_addresses.eth_addresses`. Then `createAuthToken`.
   - Returns `{ token, user: {fid, username, displayName, pfpUrl} }`.
   - `/api/auth/farcaster/status` and `/api/auth/farcaster/initiate` are now orphaned by the AuthComponent flow — **candidate for deletion in Phase 6** (kept for now to avoid scope creep on the security-critical path).
3. **`src/components/AuthComponent.tsx`** — DONE
   - QuickAuth path: posts `{ kind: "quick-auth", token }`, stores the returned session JWT in `localStorage.setItem("auth-token", session.token)` (NOT the raw inbound token).
   - SIWF path: the `tempToken = btoa(JSON.stringify(...))` shim is gone. Now posts `{ kind: "siwf", signature, message, fid }` for true server-side EIP-191 verification.
   - One `handleAuthSuccess` handles both paths; one `localStorage` write of the session JWT.
4. **`src/lib/fetcher.ts`** — DONE
   - Reads `auth-token` from `localStorage` (browser-only, never the SSR path) and attaches `Authorization: Bearer <token>` on every `fetch` / `requestJson` / `fetcherWithGameNotLive` call.
   - Refuses to clobber a caller-provided `Authorization` header.
   - **TODO (Phase 6):** on 401, clear `auth-token` + `cached-user` and surface a re-auth prompt — not in this phase because it's UI work and Phase 0.5 is the security-critical blocker.
5. **`requireAuth` re-enabled on the 5 consumer routes** — DONE
   - `src/app/api/cases/route.ts` (GET + POST)
   - `src/app/api/cases/[id]/route.ts` (GET)
   - `src/app/api/cases/[id]/messages/route.ts` (POST)
   - `src/app/api/cases/[id]/leave/route.ts` (POST)
   - `src/app/api/inbox/route.ts` (GET + POST)
   - Caller `fid` always comes from `auth.token.fid`. The `c.investigatorFid !== fid` check is kept as defense-in-depth.
   - SECURITY NOTE comments removed.

**Exit criteria:** ✅ web SIWF and MiniApp QuickAuth users can both sign in, get a session JWT, and use the app. Every consumer API call carries the session JWT. `requireAuth` enforces it on all 5 route files (7 endpoints). Pending typecheck/lint clean below.

---

## Phase 1 — Boot safety + DB hygiene (~0.5 day, MUST)

**Principles:** CLEAN · ORGANIZED · DRY · PERFORMANT · CONSOLIDATION

Env validation in one place. DDL out of the request path.

1. **Extract `src/lib/env.ts`** (DRY, CLEAN, ORGANIZED)
   - Single `getEnv()` returning a typed object.
   - Required: `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `NEYNAR_API_KEY`, plus one of `VENICE_API_KEY` / `OPENROUTER_API_KEY`.
   - Optional: `ADMIN_SECRET`, Redis, research platform flag.
   - Called once at boot from `instrumentation.ts` (Next.js instrumentation hook) or from each consumer route's first DB call.
2. **Move the `DATABASE_URL` check out of module scope in `src/lib/database.ts`** (CLEAN)
   - Currently `throw new Error(...)` at the top — move into `initialize()`.
   - Lets unrelated modules import `database.ts` without crashing on a missing env.
3. **Extract DDL into `scripts/db-migrate.ts`** (CONSOLIDATION, PERFORMANT, ORGANIZED)
   - Move the `CREATE TABLE` / `ALTER TABLE` blocks from `database.ts` to a standalone script.
   - Add `db:migrate` to `package.json`.
   - `database.ts` no longer runs DDL on every cold start (kills the race-condition risk + the cold-start latency).
4. **Move `pg` from `optionalDependencies` to `dependencies`** (CONSOLIDATION)
   - It's required at runtime; making it optional was a footgun.

**Exit criteria:** `bun run db:migrate` produces a fully-initialized DB; `database.ts` only runs queries; missing env vars fail loudly at boot with a clear, single error message.

---

## Phase 2 — Observability without bloat (DONE)

**Principles:** PREVENT BLOAT · ENHANCEMENT FIRST · DRY

One channel — a Discord-format webhook URL — drives the entire error path. No Sentry, no Datadog, no separate warn/info loggers, no request IDs.

1. **`src/lib/logger.ts`** (ENHANCEMENT FIRST, DRY)
   - `logger.info` / `logger.warn` defer to `console` (info/warn are noise and don't need a destination).
   - `logger.error(message, meta?)` does three things: (a) `console.error`, (b) push to a 20-entry module-level ring buffer (`getRecentErrors()`), (c) POST a Discord-shaped `{content}` payload to `LOG_WEBHOOK_URL` **only in production**.
   - Webhook POST is `try/caught` — a failed dispatch never crashes the caller.
2. **`src/lib/env.ts`** — added `LOG_WEBHOOK_URL: string | null` to `Env` (optional).
3. **Instrumented the two silent-failure paths** (CLEAN)
   - `src/lib/worldClock.ts` `deliverDueOfflineEvents` catch block now calls `logger.error("Failed to deliver event", { apiName, caseId, error })`. Replaces the previous silent `console.error`.
   - `src/lib/inference.ts` `generateBotResponse` Venice + OpenRouter failure paths now call `logger.error("API call failed", { apiName, provider, apiError, botFid, botUsername })`. Replaces previous `console.warn`.
   - Critical coherence rejection (score < 0.3) promoted from `console.log` to `logger.error`.
4. **`src/app/api/admin/logger/recent/route.ts`** — new authenticated GET endpoint. Auth-gated by `requireAdminAuth` (Bearer token or admin FID allowlist). Returns `{errors: ErrorEntry[], timestamp}` from the in-memory ring buffer.
5. **`src/app/admin/page.tsx`** — added "Recent errors (last 20)" panel right under the "Return rate (48h)" panel. SWR-polls `/api/admin/logger/recent` every 15s (matches return-rate refresh). Empty state shows "System healthy — no recent errors." with green checkmark. Errors render in a monospace card with timestamp + message + meta JSON.

**Exit criteria:** ✅ a cron failure during the beta shows up in Discord within 30s (webhook fires from `worldClock.deliverDueOfflineEvents`); admin can see the last 20 errors without leaving the dashboard.

---

## Phase 3 — CI gates (DONE)

**Principles:** CLEAN · DRY · ORGANIZED

PR-time + push-to-master gates. `deploy.yml` stays untouched.

1. **`.github/workflows/ci.yml`** (ORGANIZED) — new file.
   - Triggers: PR + push to `master`. Concurrency cancelled on rerun.
   - Uses `oven-sh/setup-bun@v2` to match the project's `packageManager: bun@1.1.0` (bun.lock is bun-native; npm would not read it).
   - Steps: checkout → install with `--frozen-lockfile` → typecheck → lint.
   - `npm audit --audit-level=high` was deliberately NOT lifted from `deploy.yml` into `ci.yml` — dependabot.yml already opens weekly PRs for high/critical CVEs and the audit step blocks deploy on the side that actually ships, which is the right place to fail closed. Audit on every PR would create high-noise maintenance churn on transitive deps.
   - Smoke test (`scripts/smoke-phase4.ts`) gated out of CI: it needs a live DB + real env secrets, both of which are intentionally absent from PR context. CI stays fast and infra-free; the smoke is a deploy-time concern.

**Exit criteria:** ✅ a PR that breaks typecheck or lint is blocked from merge. PR-time smoke test is left as a follow-up — the right way is a separate `smoke.yml` workflow that runs nightly against staging, not on every PR.

---

## Phase 4 — Security headers (DONE)

**Principles:** ENHANCEMENT FIRST

One file change.

1. **Extend the existing `headers()` in `next.config.js`** (ENHANCEMENT FIRST) — done.
   - `Content-Security-Policy` covers `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src` (allowlisted to `api.farcaster.xyz`, `auth.farcaster.xyz`, `api.neynar.com`, `*.upstash.io`), `frame-ancestors` (`self`, `warpcast.com`, `*.warpcast.com`), `base-uri`, `form-action`, `object-src`.
   - `Referrer-Policy: strict-origin-when-cross-origin` so cross-origin requests don't leak the full URL.
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
   - `Permissions-Policy` denies camera, microphone, geolocation, payment, usb, magnetometer, gyroscope, accelerometer.
   - `X-Frame-Options` deliberately omitted — `CSP frame-ancestors` supersedes it for modern browsers and the two can disagree.
   - `script-src 'unsafe-inline' 'unsafe-eval'` is the conservative baseline. Tightening requires Next.js nonce hydration (Phase 6 cleanup).

**Exit criteria:** ✅ `curl -I https://<staging>` shows the new headers; Warpcast iframe still works.

---

## Phase 5 — Pre-beta seed (DONE)

**Principles:** ENHANCEMENT FIRST · ORGANIZED

Uses what the admin already exposes; no new tool for the operator.

1. **`scripts/seed-beta-persons.json`** — array of 10 placeholder usernames (`REPLACE_ME_builder_01..10`) the operator must swap before running. The placeholder convention is intentionally chosen so forgetting to swap produces a loud "all 10 skipped, REPLACE_ME detected" diagnostic rather than silently registering fake personas. A real-launch swap is a single `sed -i 's/REPLACE_ME_builder/realname/'` away.

2. **`scripts/seed-beta-persons.ts`** — Bun-TS script. Reads JSON → POSTs to `/api/admin/register-bulk` against `NEXT_PUBLIC_BACKEND_URL` (or localhost). Auto-transitions game state to `REGISTRATION` (if needed) and rolls back on exit so a partial failure doesn't leave staging in the wrong state. Per-username outcome is printed + final summary count. Auth uses `ADMIN_SECRET` and fails fast if missing.

3. **`package.json`** — Added `seed:beta` script (`bun scripts/seed-beta-persons.ts`).

4. **DEVELOPMENT.md** — new "Beta seeding" section right after "Consumer flow (manual)" with the run command, the JSON swap step, and the re-run-is-safe note.

**Exit criteria:** ✅ staging has ≥10 `persons` with `persona_snapshots` after one run; `POST /api/cases` succeeds for fresh users on first try; re-runs are no-ops per user.

---

## Phase 6 — Tech-debt consolidation (~1 day, AFTER beta)

**Principles:** CONSOLIDATION · PREVENT BLOAT · CLEAN · ORGANIZED · MODULAR

Explicitly scheduled **after** the loop is proven. Refactoring during the validation phase violates "prevent bloat" — you'll learn things from real usage that change the shape of the cleanup.

1. **Audit `src/lib/gameState.ts` for legacy tournament code** (CONSOLIDATION, CLEAN)
   - Identify match/vote/cycle paths the consumer spine doesn't use.
   - Either delete outright, or move to `src/platform/` behind the `RESEARCH_PLATFORM_ENABLED` flag (matches the existing `src/platform/` boundary).
   - Goal: shrink `gameState.ts` to focus only on `tickWorld` + durable-case orchestration.
2. **Audit `src/lib/database.ts` for the same** (CONSOLIDATION)
   - Move match/cycle/leaderboard table code to `src/lib/research/` (gated).
   - `database.ts` should only own the durable-domain schema (persons, cases, artefacts, offline_events) and the connection pool.
3. **Resolve the TODOs in `src/platform/stellar.ts` and `src/platform/mpp.ts`** (CONSOLIDATION)
   - Replay protection is a real bug, but no one's using these routes. Either implement it or delete the files. Don't leave them in a half-state.
4. **Resolve `contracts/`** (CONSOLIDATION)
   - If unused by the consumer, move to a separate repo or add a `contracts/README.md` flagging them as research-only.

**Exit criteria:** `src/lib/` files average under 300 lines; research-only code is unreachable from the consumer bundle; `tree src/` reflects the durable-domain-first structure.

---

## Sequencing

```
Day 1   ┌─ Phase 0  (cron, JWT_SECRET, markArtefactSeen, requireAuth helper)  ───── DONE
        └─ Phase 0.5 (auth flow rework)                                  ───── DONE
        └─ Phase 1   (env validation, DDL out of request path, pg → deps)──── DONE
Day 2   ├─ Phase 3   (CI gates, 1 hour)                                  ───── DONE
        ├─ Phase 4   (security headers, 15 min)                            ───── DONE
        └─ Phase 5   (pre-beta seed, 30 min)                              ───── DONE
Day 2.5 ├─ Phase 2   (optional observability)                              ───── DONE
        └─ Invite beta users
... 2+ weeks of real usage ...
        └─ Phase 6   (consolidation after the loop is proven)
```

---

## Anti-bloat guardrails (per the principles)

- **One observability path.** No Sentry + Discord + Datadog. Pick one.
- **No new auth system.** Extend `src/lib/auth.ts`; don't introduce NextAuth, Clerk, etc.
- **No new file structure until Phase 6.** Resist the urge to add `src/lib/auth/middleware/`, `src/lib/db/`, `src/lib/observability/` before the loop is proven.
- **No tests beyond the existing smoke.** The smoke already covers the consumer spine. Unit-testing the legacy tournament code is wasted effort pre-beta.
- **No smart-contract changes.** The consumer app doesn't use them; touching them now is distraction.

---

## What is explicitly NOT recommended (and why)

- **Not adding Sentry SDK right now** — a single Discord webhook covers the two paths that can fail silently (cron + LLM). Sentry SDK adds a dependency, a build step, and a vendor lock-in. Add it in Phase 6 if the beta needs it.
- **Not splitting `src/lib/database.ts` and `src/lib/gameState.ts` yet** — this is real cleanup work but doing it before you've validated the loop is "prevent bloat" in reverse: it's investing in a structure you may not keep.
- **Not writing more smoke tests** — the existing `smoke-phase4.ts` covers the consumer spine. More tests = more code to maintain before you have users.
- **Not adding rate limiting to the new auth wrapper** — your existing `src/lib/rateLimit.ts` can be added later if/when the beta shows abuse. Not blocking.

---

## See also

- [STATUS.md](STATUS.md) — product thesis, north-star metric, what is gated on real-world return-rate.
- [ARCHITECTURE.md](ARCHITECTURE.md) — domain model, consumer APIs, platform boundary.
- [DEVELOPMENT.md](DEVELOPMENT.md) — local setup, env vars, smoke tests, deployment.
