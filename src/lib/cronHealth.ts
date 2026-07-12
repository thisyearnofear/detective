/**
 * World-tick heartbeat — Redis-backed liveness signal for /api/cron/tick.
 *
 * PURPOSE: One machine's cron dies → the world stops. A separate ping keeps
 * Redis healthy until traffic arrives, but Redis alone doesn't fail loud.
 * The heartbeat lets:
 *   1. /api/cron/tick write `world:tick_heartbeat` on every successful tick
 *      with a 20-minute TTL (so two missed 10-min ticks still leave a key).
 *   2. /api/cases GET — a high-traffic read — lazily check the key and fire
 *      a single logger.error per hour if it's missing (debounced via
 *      `world:tick_heartbeat_alerted:<hourBucket>`).
 *   3. /api/health (public, no auth) — return 200/503 so an external probe
 *      like BetterUptime can detect cron death without depending on traffic.
 *
 * FAIL OPEN: every call swallows Redis errors so a Redis outage degrades
 * gracefully — missing heartbeats fire a warning, never a hard error on the
 * caller. The cron itself is still functional without Redis.
 */

import { redis } from "./redis";
import { logger } from "./logger";

/**
 * 20-minute heartbeat TTL — covers two missed 10-minute cron ticks before
 * the key is considered stale. Tuned together with the cron schedule; do
 * not change one without the other.
 */
export const HEARTBEAT_TTL_SECONDS = 1200;

/**
 * 1-hour debounce window for the lazy "tick stale" alert. The first caller
 * after the heartbeat goes missing fires logger.error; later callers
 * within the bucket are silenced. Resets every wall-clock hour.
 */
export const ALERT_DEBOUNCE_TTL_SECONDS = 3600;

const HEARTBEAT_KEY = "world:tick_heartbeat";

function alertDebounceKey(): string {
  const hourBucket = Math.floor(Date.now() / 1000 / 3600);
  return `world:tick_heartbeat_alerted:${hourBucket}`;
}

export interface HeartbeatSnapshot {
  /** Wall-clock ms of the most recent tick, or null if no heartbeat exists. */
  lastTickAtMs: number | null;
  /** Age in milliseconds, or null if no heartbeat exists. */
  ageMs: number | null;
  /** `true` when lastTickAtMs is within `HEARTBEAT_TTL_SECONDS` of now. */
  isFresh: boolean;
}

/**
 * Read the current heartbeat snapshot. Returns `isFresh: false` if the key
 * is missing OR the recorded tick is older than `HEARTBEAT_TTL_SECONDS`.
 */
export async function getTickHeartbeat(): Promise<HeartbeatSnapshot> {
  try {
    const raw = await redis.get(HEARTBEAT_KEY);
    if (!raw) {
      return { lastTickAtMs: null, ageMs: null, isFresh: false };
    }
    const lastTickAtMs = Number(raw);
    if (!Number.isFinite(lastTickAtMs)) {
      // Corrupt entry — treat as missing.
      return { lastTickAtMs: null, ageMs: null, isFresh: false };
    }
    const ageMs = Date.now() - lastTickAtMs;
    return {
      lastTickAtMs,
      ageMs,
      isFresh: ageMs >= 0 && ageMs <= HEARTBEAT_TTL_SECONDS * 1000,
    };
  } catch {
    return { lastTickAtMs: null, ageMs: null, isFresh: false };
  }
}

/**
 * Write (or refresh) the heartbeat. Called by /api/cron/tick after every
 * successful tick. Errors are swallowed so a Redis outage never breaks the
 * cron itself — the next successful tick will refresh the key.
 */
export async function recordTickHeartbeat(): Promise<void> {
  try {
    await redis.setex(HEARTBEAT_KEY, HEARTBEAT_TTL_SECONDS, String(Date.now()));
  } catch (err) {
    console.warn(
      "[cronHealth] heartbeat write failed (tick still ran):",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Lazy staleness check — meant to be called from high-traffic consumer
 * routes. If the heartbeat is missing AND no debounce key has been set in
 * the current hour, fire one logger.error and claim the debounce. Safe to
 * `void` from any handler.
 *
 * Latency budget: one Redis GET + at most one Redis SETEX (cold-cache
 * path). Hot-cache path = single GET. The wrapper retries are avoided in
 * favor of "fire and forget" so the route handler is not slowed by the
 * staleness check itself.
 */
export async function maybeAlertStaleTick(): Promise<void> {
  // Lazy staleness checks fire logger.error when the heartbeat is missing.
  // Dev environments frequently run without a cron, so an alert there is
  // noise. Production is the only signal surface that warrants a wake-up.
  if (process.env.NODE_ENV !== "production") return;

  try {
    const hb = await getTickHeartbeat();
    if (hb.isFresh) return;

    // `setex` with NX would be ideal, but Upstash's `set` supports NX. We
    // claim the debounce key first; if it fails to claim, someone else in
    // the window already fired.
    const claimed = await redis.set(alertDebounceKey(), "1", {
      ex: ALERT_DEBOUNCE_TTL_SECONDS,
      nx: true,
    });
    if (claimed !== "OK") return;

    logger.error(
      "[heartbeat] world tick is stale; offline events likely not delivering",
      {
        lastTickAt: hb.lastTickAtMs
          ? new Date(hb.lastTickAtMs).toISOString()
          : "never",
        ageMs: hb.ageMs,
      },
    );
  } catch (err) {
    // Swallow — staleness alerting must never break a consumer route.
    console.warn(
      "[cronHealth] staleness check failed (continuing):",
      err instanceof Error ? err.message : err,
    );
  }
}
