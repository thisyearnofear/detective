/**
 * Application logging — Phase 2 of the pre-beta hardening plan.
 *
 * Single channel: a Discord-format webhook URL drives the entire error path.
 * No Sentry, no Datadog, no separate warn/info loggers, no request IDs.
 *
 * Anti-bloat guards:
 * - `info` and `warn` defer to `console` — they're noise, not risk.
 * - Only `error` produces a side-effect destination (the admin ring buffer
 *   + an optional Discord webhook in production).
 * - Webhook POST is wrapped in try/catch — a failed dispatch never crashes
 *   the caller. The error still goes to the ring buffer so admin can see it.
 */

import { getEnv } from "./env";

export interface ErrorEntry {
  /** ISO 8601 timestamp the entry was created. */
  timestamp: string;
  /** Human-readable error message. */
  message: string;
  /** Optional structured detail. */
  meta?: Record<string, unknown>;
}

export type ErrorMeta = Record<string, unknown>;

const RING_BUFFER_SIZE = 20;
const errorBuffer: ErrorEntry[] = [];

/**
 * Module-level 20-entry ring buffer (FIFO). Read by the admin endpoint.
 * Holds only error-level entries — info/warn go to console only.
 */
function pushError(entry: ErrorEntry): void {
  errorBuffer.push(entry);
  if (errorBuffer.length > RING_BUFFER_SIZE) {
    errorBuffer.shift();
  }
}

export const logger = {
  info(message: string, meta?: ErrorMeta): void {
    if (meta) {
      console.log(`[info] ${message}`, meta);
    } else {
      console.log(`[info] ${message}`);
    }
  },
  warn(message: string, meta?: ErrorMeta): void {
    if (meta) {
      console.warn(`[warn] ${message}`, meta);
    } else {
      console.warn(`[warn] ${message}`);
    }
  },
  /**
   * Records the error in three places:
   *   1. console.error (always).
   *   2. The 20-entry ring buffer (always; admin endpoint reads this).
   *   3. The Discord webhook (production only, when LOG_WEBHOOK_URL is set).
   *
   * Post #3 failures are swallowed; the ring buffer entry still exists.
   */
  error(message: string, meta?: ErrorMeta): void {
    const entry: ErrorEntry = {
      timestamp: new Date().toISOString(),
      message,
      meta,
    };

    if (meta) {
      console.error(`[error] ${message}`, meta);
    } else {
      console.error(`[error] ${message}`);
    }

    pushError(entry);

    // Webhook dispatch — fire-and-forget. We do not await because callers
    // should not pay the latency of a webhook round-trip on every error.
    void dispatchToWebhook(entry);
  },
};

/**
 * Newest-first read of the in-memory ring buffer. Cloned so callers cannot
 * mutate internal state.
 */
export function getRecentErrors(): ErrorEntry[] {
  return [...errorBuffer].reverse();
}

async function dispatchToWebhook(entry: ErrorEntry): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  let webhookUrl: string | null;
  try {
    webhookUrl = getEnv().LOG_WEBHOOK_URL;
  } catch {
    // Env not initialized yet (e.g. early in boot); skip silently.
    return;
  }
  if (!webhookUrl) return;

  const metaJson = entry.meta
    ? "\n```json\n" + JSON.stringify(entry.meta, null, 2) + "\n```"
    : "";

  const body = {
    content: `🚨 **Error in Detective** @ ${entry.timestamp}\n${entry.message}${metaJson}`,
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 3s cap — we are fire-and-forget; never let a slow webhook tie up
      // the calling request.
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    // Swallow: webhook failure is non-fatal for the caller. The entry is
    // still in the ring buffer so an operator can see it on the admin page.
    console.warn(
      `[logger] webhook dispatch failed (entry still in ring buffer): ${
        (err as Error).message ?? String(err)
      }`,
    );
  }
}
