/**
 * Environment Variable Validation (Phase 1)
 *
 * Single source of truth for runtime env access. Required vars are validated
 * at first call; missing required vars in production fail loud with a clear
 * error. In dev, missing required vars are tolerated (logged) so partial-env
 * workflows (e.g. local code-gen) still work — runtime errors will surface
 * naturally when the missing var is actually used.
 *
 * DRY: callers don't repeat `process.env.X || ""` and don't sprinkle
 * `if (!process.env.X) throw ...` checks across the codebase.
 *
 * CLEAN: returns a typed `Env` object; downstream code gets null/undefined
 * discrimination instead of magic-string sentinels.
 */

export interface Env {
  // Required — fail in production if missing
  DATABASE_URL: string;
  JWT_SECRET: string;
  CRON_SECRET: string;
  NEYNAR_API_KEY: string;

  // AI provider — at least one required in production
  VENICE_API_KEY: string | null;
  OPENROUTER_API_KEY: string | null;

  // Optional — degraded experience if missing (Redis cache disabled, etc.)
  UPSTASH_REDIS_REST_URL: string | null;
  UPSTASH_REDIS_REST_TOKEN: string | null;
  ADMIN_SECRET: string | null;
  LOG_WEBHOOK_URL: string | null;
  APP_URL: string | null;

  // Research platform flags
  RESEARCH_PLATFORM_ENABLED: boolean;
  STORACHA_ENABLED: boolean;
}

// Required production vars are validated by `readRequired` inside `getEnv()`.
// The list is intentionally inlined as `readRequired("X")` calls so each
// call site has a clear failure path (which var is missing).
let warnedMissing = false;

function readRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `[env] ${key} is required in production. Refusing to start without it.`,
      );
    }
    if (!warnedMissing) {
      console.warn(
        `[env] ${key} is not set. Some functionality will be unavailable until it is.`,
      );
      warnedMissing = true;
    }
    return "";
  }
  return value;
}

function readOptional(key: string): string | null {
  return process.env[key] || null;
}

function readBoolean(key: string): boolean {
  return process.env[key] === "true";
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const venice = readOptional("VENICE_API_KEY");
  const openrouter = readOptional("OPENROUTER_API_KEY");
  if (!venice && !openrouter && process.env.NODE_ENV === "production") {
    throw new Error(
      "[env] At least one of VENICE_API_KEY or OPENROUTER_API_KEY must be set in production.",
    );
  }

  const env: Env = {
    DATABASE_URL: readRequired("DATABASE_URL"),
    JWT_SECRET: readRequired("JWT_SECRET"),
    CRON_SECRET: readRequired("CRON_SECRET"),
    NEYNAR_API_KEY: readRequired("NEYNAR_API_KEY"),
    VENICE_API_KEY: venice,
    OPENROUTER_API_KEY: openrouter,
    UPSTASH_REDIS_REST_URL: readOptional("UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: readOptional("UPSTASH_REDIS_REST_TOKEN"),
    ADMIN_SECRET: readOptional("ADMIN_SECRET"),
    LOG_WEBHOOK_URL: readOptional("LOG_WEBHOOK_URL"),
    APP_URL: readOptional("APP_URL"),
    RESEARCH_PLATFORM_ENABLED: readBoolean("RESEARCH_PLATFORM_ENABLED"),
    STORACHA_ENABLED: readBoolean("STORACHA_ENABLED"),
  };

  // Cache only in production — env is set at build time, no reason to re-read.
  if (process.env.NODE_ENV === "production") {
    cached = env;
  }

  return env;
}

/**
 * Force the env to be re-read on the next `getEnv()` call.
 * Useful in tests; not used in production.
 */
export function resetEnvCache(): void {
  cached = null;
  warnedMissing = false;
}
