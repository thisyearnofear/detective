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
 * - `time` runs on a separate 100-entry ring buffer (`TIMING_BUFFER_SIZE`) so
 *   successful responses never evict actual errors from the smaller
 *   `RING_BUFFER_SIZE`. The two channels are intentionally independent.
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

// =====================================================================
// Timing channel — independent from the error channel so successful
// responses don't evict real errors. Phase 2 perf-baseline work uses this
// to compute p50/p95/p99 latency over windows via `reportTimings()`.
// =====================================================================

export interface TimingEntry {
  /** ISO 8601 timestamp the entry was created. */
  timestamp: string;
  /** Caller-supplied route tag — e.g. `/api/cases/[id] GET`. */
  route: string;
  /** HTTP method — `GET`, `POST`, etc. Required so logs are not silently mislabelled. */
  method: string;
  /** Elapsed wall-clock milliseconds. */
  ms: number;
  /** `true` if the wrapped fn threw. */
  errored: boolean;
}

export const TIMING_BUFFER_SIZE = 100;
const timingBuffer: TimingEntry[] = [];

/**
 * Push a timing entry into the per-route FIFO ring buffer.
 * When the buffer overflows we evict the oldest entry first.
 */
function pushTiming(entry: TimingEntry): void {
  timingBuffer.push(entry);
  if (timingBuffer.length > TIMING_BUFFER_SIZE) {
    timingBuffer.shift();
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
  /**
   * Wraps an async function and records its wall-clock duration on the
   * dedicated timing ring buffer. Does NOT touch the error ring buffer —
   * successful responses are not errors. On throw, the error still surfaces
   * to the caller (so the route's `catch` block can route it via
   * `logger.error`); the timing entry is recorded with `errored: true` so
   * `reportTimings()` can compute error rates.
   *
   * Usage:
   *   return logger.time("/api/cases/[id]", "GET", async () => {
   *     // handler body
   *   });
   *
   *   method is REQUIRED — defaulting to "GET" silently mislabelled POSTs
   *   and corrupted the by-method percentile view in the admin report.
   */
  async time<T>(
    route: string,
    method: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    let errored = false;
    try {
      return await fn();
    } catch (err) {
      errored = true;
      throw err;
    } finally {
      const ms = Date.now() - startedAt;
      pushTiming({
        timestamp: new Date(startedAt).toISOString(),
        route,
        method,
        ms,
        errored,
      });
    }
  },
};

/**
 * Newest-first read of the in-memory ring buffer. Cloned so callers cannot
 * mutate internal state.
 */
export function getRecentErrors(): ErrorEntry[] {
  return [...errorBuffer].reverse();
}

/**
 * Newest-first read of the timing ring buffer.
 */
export function getRecentTimings(): TimingEntry[] {
  return [...timingBuffer].reverse();
}

export interface TimingReport {
  /** Number of timings considered (after the optional window filter). */
  count: number;
  /** Median latency in milliseconds; `null` when count is zero. */
  p50: number | null;
  /** 95th-percentile latency in milliseconds; `null` when count is zero. */
  p95: number | null;
  /** 99th-percentile latency in milliseconds; `null` when count is zero. */
  p99: number | null;
  /** Fraction of timings with `errored: true` (0..1). */
  errorRate: number;
  /** Optional filter applied — when omitted, the full buffer is used. */
  route?: string;
}

/**
 * Compute p50/p95/p99 + error rate over the timing ring buffer.
 *
 * The default filter is the full buffer; callers can pass `route` to focus
 * on a single path or `windowMs` to limit to the last N milliseconds of
 * activity (useful for "last 5 minutes" views on the admin page).
 *
 * Percentiles use the nearest-rank method — adequate for an ops surface,
 * not a regression-test statistic. The admin page renders the 0/50/95/99
 * reading verbatim, so the operator sees the same number we report.
 */
export function reportTimings(options?: {
  route?: string;
  windowMs?: number;
}): TimingReport {
  const filtered = timingBuffer.filter((t) => {
    if (options?.route && t.route !== options.route) return false;
    if (options?.windowMs) {
      const age = Date.now() - new Date(t.timestamp).getTime();
      if (age > options.windowMs) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return {
      count: 0,
      p50: null,
      p95: null,
      p99: null,
      errorRate: 0,
      route: options?.route,
    };
  }

  const sorted = [...filtered].sort((a, b) => a.ms - b.ms);
  const last = sorted.length - 1;
  const nearestRank = (p: number) => sorted[Math.min(last, Math.floor(p * sorted.length))].ms;
  const errorCount = filtered.filter((t) => t.errored).length;

  return {
    count: filtered.length,
    p50: nearestRank(0.5),
    p95: nearestRank(0.95),
    p99: nearestRank(0.99),
    errorRate: errorCount / filtered.length,
    route: options?.route,
  };
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
