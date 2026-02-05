import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyMessage } from "viem";
import { requireAgentPayment } from "@/lib/payments";
import { type AgentEndpoint } from "@/lib/gameConstants";

/**
 * Validates Agent API requests using EIP-191 cryptographic signatures.
 * 
 * CONSOLIDATION: Removed legacy AGENT_SECRET auth (aggressive cleanup)
 * All agents must now use wallet signatures for authentication.
 */
export async function validateAgentRequest(
  request: NextRequest, 
  payload?: any
): Promise<{ authorized: boolean; address?: string }> {
  const signature = request.headers.get("x-agent-signature");
  const address = request.headers.get("x-agent-address");
  const timestamp = request.headers.get("x-agent-timestamp");

  if (!signature || !address) {
    return { authorized: false };
  }

  try {
    let messageToVerify = "";

    if (payload) {
      // POST request: sign the request body
      messageToVerify = typeof payload === "string" 
        ? payload 
        : JSON.stringify(payload);
    } else if (timestamp) {
      // GET request: sign timestamp-based challenge
      const searchParams = request.nextUrl.searchParams;
      const targetFid = searchParams.get("fid") || "all";
      
      // Prevent replay attacks (5 minute window)
      const ts = parseInt(timestamp, 10);
      const now = Date.now();
      if (isNaN(ts) || Math.abs(now - ts) > 300000) {
        console.warn("[AgentAuth] Timestamp outside valid window:", ts);
        return { authorized: false };
      }

      messageToVerify = `pending:${targetFid}:${timestamp}`;
    } else {
      return { authorized: false };
    }

    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message: messageToVerify,
      signature: signature as `0x${string}`,
    });

    if (isValid) {
      return { authorized: true, address: address.toLowerCase() };
    }
  } catch (error) {
    console.error("[AgentAuth] Signature verification failed:", error);
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

/**
 * Unified guard for agent API endpoints
 * Composes: auth + rate limiting + x402 payment (optional)
 * 
 * ENHANCEMENT: Single entry point replaces boilerplate in routes
 * DRY: All validation logic in one place
 */
export interface GuardOptions {
  rateKey: string;
  rateLimit?: number;
  rateWindow?: number;
  priceKey?: AgentEndpoint; // If set, requires x402 payment
  payload?: any; // For POST request body validation
}

export interface GuardResult {
  ok: true;
  auth: { authorized: boolean; address?: string };
  receiptId?: string;
}

export interface GuardError {
  ok: false;
  response: NextResponse;
}

export async function guardAgentEndpoint(
  request: NextRequest,
  opts: GuardOptions
): Promise<GuardResult | GuardError> {
  // 1. Authenticate (signature or legacy secret)
  const auth = await validateAgentRequest(request, opts.payload);
  
  if (!auth.authorized) {
    return { ok: false, response: unauthorizedResponse() };
  }

  // 2. Rate Limiting (prefer address over IP for signed requests)
  const identifier = auth.address || 
    request.headers.get("x-forwarded-for") || 
    "unknown";
  
  const limit = await checkRateLimit(
    `${opts.rateKey}:${identifier}`,
    opts.rateLimit ?? 60,
    opts.rateWindow ?? 60
  );

  if (!limit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Please slow down.", remaining: limit.remaining },
        { status: 429 }
      ),
    };
  }

  // 3. x402 Payment (if endpoint requires payment)
  if (opts.priceKey) {
    const payment = await requireAgentPayment(request, opts.priceKey, auth.address);
    
    if (!payment.ok) {
      return { ok: false, response: payment.response };
    }
    
    return { ok: true, auth, receiptId: payment.receiptId };
  }

  return { ok: true, auth };
}