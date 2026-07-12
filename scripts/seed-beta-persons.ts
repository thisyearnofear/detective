#!/usr/bin/env bun
/**
 * Pre-beta seeding script (Phase 5 of the hardening plan).
 *
 * Reads `scripts/seed-beta-persons.json` (an array of Farcaster usernames)
 * and registers each as both a runtime Player AND a durable Person +
 * PersonaSnapshot via the existing `/api/admin/register-bulk` endpoint.
 *
 * Game-state handling: this script temporarily transitions the game to
 * `REGISTRATION`, runs the bulk register (which only accepts that state),
 * then rolls the state back to whatever it was before.
 *
 * Targets the URL in `NEXT_PUBLIC_BACKEND_URL`, falling back to
 * http://localhost:3000 for local runs.
 *
 * Auth: `Authorization: Bearer ${ADMIN_SECRET}`. Exits non-zero if missing.
 *
 * Run: `bun run seed:beta`
 *
 * Theoretical edge cases documented inline below.
 */

// ---------------------------------------------------------------------------
// Constants + auth
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error(
    "[seed:beta] ADMIN_SECRET is not set. Refusing to run — admin endpoints would 401 anyway.",
  );
  process.exit(2);
}

const authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ADMIN_SECRET}`,
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function readUsernames(): Promise<string[]> {
  const path = "scripts/seed-beta-persons.json";
  let raw: string;
  try {
    raw = await Bun.file(path).text();
  } catch (err) {
    throw new Error(`Could not read ${path}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON array of username strings`);
  }

  const usernames = parsed
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim().replace(/^@/, "").toLowerCase())
    .filter((u) => u.length > 0);

  if (usernames.length === 0) {
    throw new Error(`${path} contains no usernames`);
  }

  // Detect the placeholder convention so we surface it loudly. Operators
  // who forget to swap `REPLACE_ME_*` placeholders before running against a
  // real environment would otherwise see "0 registered" without explanation.
  const placeholders = usernames.filter((u) =>
    u.toLowerCase().startsWith("replace_me_"),
  );
  if (placeholders.length > 0) {
    console.warn(
      `[seed:beta] WARNING: ${placeholders.length}/${usernames.length} usernames are still REPLACE_ME_* placeholders. The API will reject them.`,
    );
  }

  return usernames;
}

async function getGameState(): Promise<string> {
  const res = await fetch(`${API_URL}/api/admin/state`, { headers: authHeaders });
  if (!res.ok) {
    throw new Error(`Could not read game state (HTTP ${res.status})`);
  }
  const data = (await res.json()) as {
    gameState?: { state?: string };
  };
  const state = data.gameState?.state;
  if (!state) {
    throw new Error("Game state response missing gameState.state");
  }
  return state;
}

async function transitionTo(state: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/state`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ action: "transition", state }),
  });
  if (!res.ok) {
    throw new Error(
      `Could not transition to ${state} (HTTP ${res.status} ${res.statusText})`,
    );
  }
}

interface BulkRegisterResult {
  username: string;
  success: boolean;
  fid?: number;
  reason?: string;
}

interface BulkRegisterResponse {
  success: boolean;
  total: number;
  registered: number;
  failed: number;
  results: BulkRegisterResult[];
}

async function bulkRegister(usernames: string[]): Promise<BulkRegisterResponse> {
  const res = await fetch(`${API_URL}/api/admin/register-bulk`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ usernames }),
  });

  // Fatal auth errors are non-recoverable — fail fast so the operator knows.
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Admin auth failed (HTTP ${res.status}). Check ADMIN_SECRET and that the endpoint accepts it.`,
    );
  }
  if (!res.ok) {
    throw new Error(`Bulk register call failed (HTTP ${res.status})`);
  }

  // 200 OK — the body may still contain per-username failures. The endpoint
  // intentionally returns results in-band so a single bad username doesn't
  // block the whole batch.
  return (await res.json()) as BulkRegisterResponse;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[seed:beta] target = ${API_URL}`);

  const usernames = await readUsernames();
  console.log(`[seed:beta] loaded ${usernames.length} usernames from JSON`);

  // Snapshot the original state so we can roll back whatever it was. We
  // intentionally only ACT on the difference — if we were already in
  // REGISTRATION, do nothing; if LIVE/FINISHED, transition and rollback.
  const originalState = await getGameState();
  const transitioned = originalState !== "REGISTRATION";

  if (transitioned) {
    console.log(
      `[seed:beta] auto-transitioning state ${originalState} -> REGISTRATION`,
    );
    await transitionTo("REGISTRATION");
  } else {
    console.log(`[seed:beta] state is already REGISTRATION; no transition needed`);
  }

  // Serial registration. The /api/admin/register-bulk endpoint already
  // loops serially over usernames to respect Neynar burst limits — we send
  // them in one batch and trust it.
  const result = await bulkRegister(usernames);

  for (const r of result.results) {
    if (r.success) {
      console.log(
        `  [OK]   ${r.username}${r.fid ? ` (fid ${r.fid})` : ""}`,
      );
    } else {
      console.log(`  [SKIP] ${r.username}: ${r.reason ?? "unknown"}`);
    }
  }

  console.log(
    `[seed:beta] summary: ${result.registered}/${result.total} registered, ${result.failed} skipped/failed`,
  );

  // Roll back if we changed the state. Done in `finally`-equivalent logic
  // (we deliberately don't use try/finally because we want a clean exit code
  // and the script's stdout to remain on one line per result).
  if (transitioned) {
    try {
      console.log(
        `[seed:beta] rolling state back to ${originalState}`,
      );
      await transitionTo(originalState);
    } catch (err) {
      console.error(
        `[seed:beta] ROLLBACK FAILED: ${(err as Error).message}. ` +
          `The environment is now stuck in REGISTRATION. Manually POST ` +
          `{ action: "transition", state: "${originalState}" } to ` +
          `${API_URL}/api/admin/state to recover.`,
      );
      process.exit(3);
    }
  }
}

main().catch((err) => {
  console.error(`[seed:beta] FATAL: ${(err as Error).message}`);
  process.exit(1);
});
