import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyMessage } from "viem";

const AGENT_SECRETS = process.env.AGENT_SECRET ? process.env.AGENT_SECRET.split(",") : [];

/**
 * Validates the Agent API request using either Legacy Secret or Crypto Signature.
 */
export async function validateAgentRequest(
  request: NextRequest, 
  payload?: any
): Promise<{ authorized: boolean; address?: string }> {
  // 1. Try Cryptographic Signature Verification (EIP-191)
  const signature = request.headers.get("x-agent-signature");
  const address = request.headers.get("x-agent-address");
  const timestamp = request.headers.get("x-agent-timestamp");

  if (signature && address) {
    try {
      let messageToVerify = "";

      if (payload) {
        // POST request with body
        messageToVerify = typeof payload === "string" 
          ? payload 
          : JSON.stringify(payload);
      } else if (timestamp) {
        // GET request with timestamp-based challenge
        // Format: "pending:targetFid:timestamp"
        const searchParams = request.nextUrl.searchParams;
        const targetFid = searchParams.get("fid") || "all";
        
        // Prevent old signatures (5 minute window)
        const ts = parseInt(timestamp, 10);
        const now = Date.now();
        if (isNaN(ts) || Math.abs(now - ts) > 300000) {
          console.warn("[AgentAuth] Timestamp outside of valid window:", ts);
          return { authorized: false };
        }

        messageToVerify = `pending:${targetFid}:${timestamp}`;
      }

      if (messageToVerify) {
        const isValid = await verifyMessage({
          address: address as `0x${string}`,
          message: messageToVerify,
          signature: signature as `0x${string}`,
        });

        if (isValid) {
          return { authorized: true, address: address.toLowerCase() };
        }
      }
    } catch (error) {
      console.error("[AgentAuth] Signature verification failed:", error);
    }
  }

  // 2. Fallback to Legacy Secret Auth
  const authHeader = request.headers.get("x-agent-secret");
  if (authHeader && AGENT_SECRETS.includes(authHeader)) {
    return { authorized: true };
  }

  return { authorized: false };
}

export function unauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || "Unauthorized. Invalid signature or secret." },
    { status: 401 }
  );
}

/**
 * Simple Redis-based Rate Limiter
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
    return { allowed: true, remaining: 1 };
  }
}