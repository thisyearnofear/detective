# Scripts

Debugging and smoke helpers. Product status: [docs/STATUS.md](../docs/STATUS.md).

## Smoke (offline loop)

```bash
bun run scripts/smoke-phase4.ts
```

Schedules `follow_up` → simulates delivery → schedules `echo` → inbox unseen → mark seen.

## Common utilities

```bash
node scripts/check-state.js
node scripts/register-users.js <username1> <username2> ...
node scripts/test-neynar.js <username>
```

Ensure `.env.local` has `DATABASE_URL`, Redis, and (for register scripts) Neynar.

## Research

```bash
npm run research:batch
npm run research:export
npm run research:analyze
```

Requires `RESEARCH_PLATFORM_ENABLED=true` for live agent/Storacha HTTP surfaces.
