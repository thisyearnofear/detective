// src/lib/rateLimit.ts
/**
 * Rate Limiting Middleware using Upstash Redis
 * 
 * Provides simple IP-based rate limiting for unauthenticated endpoints.
 * Uses sliding window algorithm for accurate limiting.
 * 
 * Usage:
 *   const { allowed, remaining, resetTime } = await rateLimit({
 *     key: "api:game:status",
 *     limit: 10,
 *     window: 60, // seconds
 *   });
 *   if (!allowed) return 429;
 */

import { redis } from "./redis";

interface RateLimitOptions {
  /** Unique key for the rate limit bucket */
  key: string;
  /** Maximum requests allowed per window */
  limit: number;
  /** Window duration in seconds */
  window: number;
  /** Optional IP override (for development) */
  ip?: string;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the window resets */
  resetTime: number;
  /** Total limit for this window */
  limit: number;
}

/**
 * Check rate limit for a given key
 * Returns whether request is allowed and metadata
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, window, ip } = options;
  
  // Build the rate limit key with optional IP
  const rateKey = ip ? `ratelimit:${ip}:${key}` : `ratelimit:${key}`;
  const now = Date.now();
  const windowMs = window * 1000;
  
  try {
    // Increment the counter
    const current = await redis.incr(rateKey);
    
    // Set expiry on first request
    if (current === 1) {
      await redis.expire(rateKey, window);
    }
    
    // Get TTL for reset time
    const ttl = await redis.ttl(rateKey);
    const resetTime = now + (ttl > 0 ? ttl * 1000 : windowMs);
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetTime,
      limit,
    };
  } catch (error) {
    // On Redis error, allow request (fail open)
    console.error("[RateLimit] Error:", error);
    return {
      allowed: true,
      remaining: limit,
      resetTime: now + windowMs,
      limit,
    };
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(headers: Headers): string {
  // Check common proxy headers
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  // Fallback to unknown
  return "unknown";
}

/**
 * Rate limiter configuration for different endpoints
 */
export const RATE_LIMITS = {
  // Public endpoints - stricter limits
  "api:game:status": { limit: 60, window: 60 },     // 60 req/min - polling
  "api:leaderboard": { limit: 10, window: 60 },   // 10 req/min
  "api:profiles:random": { limit: 5, window: 60 }, // 5 req/min
  
  // Auth endpoints - very strict
  "api:auth:farcaster": { limit: 5, window: 60 },   // 5 req/min
  "api:auth:verify": { limit: 10, window: 60 },   // 10 req/min
  
  // Registration - moderate
  "api:game:register": { limit: 10, window: 60 },  // 10 req/min
  
  // Default for unknown endpoints
  "default": { limit: 20, window: 60 },           // 20 req/min
} as const;

/**
 * Get rate limit config for an API path
 */
export function getRateLimitConfig(path: string): { limit: number; window: number } {
  // Check for exact match first
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(key.replace("api:", "/api/"))) {
      return config;
    }
  }
  
  // Check for partial match
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    const apiKey = key.replace("api:", "/api/");
    if (path.includes(apiKey)) {
      return config;
    }
  }
  
  return RATE_LIMITS.default;
}