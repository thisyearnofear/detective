import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const AGENT_SECRETS = process.env.AGENT_SECRET ? process.env.AGENT_SECRET.split(",") : [];

/**
 * Validates the Agent API request.
 * Checks for the presence and correctness of the x-agent-secret header.
 * Supports multiple valid secrets (comma-separated in env).
 */
export function validateAgentRequest(request: NextRequest): boolean {
  // If no secret is configured, deny all external agent requests for security
  if (AGENT_SECRETS.length === 0) {
    console.warn("[AgentAuth] AGENT_SECRET is not set in environment variables. Denying access.");
    return false;
  }

  const authHeader = request.headers.get("x-agent-secret");
  return !!authHeader && AGENT_SECRETS.includes(authHeader);
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized. Invalid or missing x-agent-secret header." },
    { status: 401 }
  );
}

/**
 * Simple Redis-based Rate Limiter
 * limit: max requests
 * window: time window in seconds
 */
export async function checkRateLimit(
  identifier: string, 
  limit: number = 60, 
  window: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const key = `rate_limit:${identifier}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  } catch (error) {
    console.error("[RateLimit] Error checking limit:", error);
    // Fail open if Redis is down, but log it
    return { allowed: true, remaining: 1 };
  }
}