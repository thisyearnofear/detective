/**
 * Unified Payment Layer
 * 
 * SINGLE ABSTRACTION for all payment operations:
 * - x402 payment verification for agent API endpoints
 * - USDC stake receipts for Truth Stakes
 * - Idempotency via Redis receipt tracking
 * 
 * ENHANCEMENT: Extends existing auth/staking without replacing
 * DRY: All pricing reads from GAME_CONSTANTS.ECONOMY
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { GAME_CONSTANTS, type AgentEndpoint } from "@/lib/gameConstants";

const X402_CONFIG = GAME_CONSTANTS.ECONOMY.X402;
const PRICING = GAME_CONSTANTS.ECONOMY.AGENT_API_PRICING;

// x402 receipt TTL: 24 hours (prevents replay, allows reasonable retry window)
const RECEIPT_TTL_SECONDS = 86400;

/**
 * x402 Payment Required response format
 * Follows x402 spec: https://docs.x402.org
 */
interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  asset: string;
  network: string;
  nonce: string;
  expiresAt: number;
}

/**
 * Parsed x402 payment header
 */
interface X402PaymentProof {
  receiptId: string;
  amount: string;
  payer: string;
  signature: string;
  timestamp: number;
}

/**
 * Generates a 402 Payment Required response for an endpoint
 */
function createPaymentRequiredResponse(
  endpoint: AgentEndpoint,
  resource: string
): NextResponse {
  const pricing = PRICING[endpoint];
  const stakes = GAME_CONSTANTS.ECONOMY.STAKES;
  
  const payload: X402PaymentRequired = {
    maxAmountRequired: pricing.amount,
    resource,
    description: `Access to ${endpoint} endpoint requires payment`,
    payTo: X402_CONFIG.paymentAddress || "",
    asset: stakes.USDC.tokenAddress,
    network: X402_CONFIG.network,
    nonce: crypto.randomUUID(),
    expiresAt: Math.floor(Date.now() / 1000) + 300, // 5 min validity
  };

  return NextResponse.json(payload, {
    status: 402,
    headers: {
      "X-Payment-Required": JSON.stringify(payload),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Parses the x402 payment proof from request headers
 */
function parsePaymentHeader(request: NextRequest): X402PaymentProof | null {
  const paymentHeader = request.headers.get("X-Payment") || 
                        request.headers.get("X-Payment-Signature");
  
  if (!paymentHeader) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8")
    );
    
    return {
      receiptId: decoded.receiptId || decoded.paymentId,
      amount: decoded.amount,
      payer: decoded.payer || decoded.from,
      signature: decoded.signature,
      timestamp: decoded.timestamp || Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Verifies payment proof with facilitator (or locally for dev)
 * Returns true if payment is valid and sufficient
 */
async function verifyPaymentWithFacilitator(
  proof: X402PaymentProof,
  requiredAmount: string
): Promise<boolean> {
  // Dev mode: skip facilitator verification
  if (process.env.NODE_ENV === "development" && !X402_CONFIG.enabled) {
    console.log("[Payments] Dev mode: skipping x402 verification");
    return true;
  }

  try {
    const response = await fetch(`${X402_CONFIG.facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: proof.receiptId,
        amount: proof.amount,
        signature: proof.signature,
        expectedMinAmount: requiredAmount,
      }),
    });

    if (!response.ok) return false;
    
    const result = await response.json();
    return result.valid === true;
  } catch (error) {
    console.error("[Payments] Facilitator verification failed:", error);
    return false;
  }
}

/**
 * Checks if a receipt has already been used (replay protection)
 */
async function isReceiptUsed(receiptId: string): Promise<boolean> {
  try {
    const key = `x402:receipt:${receiptId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch {
    return false;
  }
}

/**
 * Marks a receipt as used with TTL
 */
async function markReceiptUsed(
  receiptId: string,
  endpoint: AgentEndpoint,
  payer?: string
): Promise<boolean> {
  try {
    const key = `x402:receipt:${receiptId}`;
    const value = JSON.stringify({
      endpoint,
      payer,
      usedAt: Date.now(),
    });
    
    // SET NX (only if not exists) + TTL
    const result = await redis.set(key, value, {
      ex: RECEIPT_TTL_SECONDS,
      nx: true,
    });
    return result === "OK";
  } catch {
    return false;
  }
}

/**
 * Main entry point: Require payment for an agent API endpoint
 * 
 * Usage in route:
 * ```ts
 * const payment = await requireAgentPayment(request, "pending");
 * if (!payment.ok) return payment.response;
 * ```
 */
export async function requireAgentPayment(
  request: NextRequest,
  endpoint: AgentEndpoint,
  payer?: string
): Promise<{ ok: true; receiptId: string } | { ok: false; response: NextResponse }> {
  
  // x402 disabled: allow all requests (free tier / dev mode)
  if (!X402_CONFIG.enabled) {
    return { ok: true, receiptId: "free-tier" };
  }

  // Payment address not configured: cannot accept payments
  if (!X402_CONFIG.paymentAddress) {
    console.warn("[Payments] x402 enabled but no payment address configured");
    return { ok: true, receiptId: "unconfigured" };
  }

  const resource = request.nextUrl.pathname;
  const pricing = PRICING[endpoint];

  // Parse payment proof from headers
  const proof = parsePaymentHeader(request);
  
  if (!proof) {
    return {
      ok: false,
      response: createPaymentRequiredResponse(endpoint, resource),
    };
  }

  // Check for replay attack
  if (await isReceiptUsed(proof.receiptId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payment receipt already used", code: "RECEIPT_REPLAY" },
        { status: 402 }
      ),
    };
  }

  // Verify with facilitator
  const valid = await verifyPaymentWithFacilitator(proof, pricing.amount);
  
  if (!valid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payment verification failed", code: "INVALID_PAYMENT" },
        { status: 402 }
      ),
    };
  }

  // Verify payer matches auth if both are present
  if (payer && proof.payer && payer.toLowerCase() !== proof.payer.toLowerCase()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payment payer does not match authenticated address", code: "PAYER_MISMATCH" },
        { status: 403 }
      ),
    };
  }

  // Mark receipt as used (idempotency)
  const marked = await markReceiptUsed(proof.receiptId, endpoint, payer || proof.payer);
  
  if (!marked) {
    // Race condition: another request used this receipt
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payment receipt already used", code: "RECEIPT_REPLAY" },
        { status: 402 }
      ),
    };
  }

  return { ok: true, receiptId: proof.receiptId };
}

/**
 * Formats a stake amount for display
 */
export function formatStakeAmount(
  amount: string,
  currency: keyof typeof GAME_CONSTANTS.ECONOMY.STAKES
): string {
  const config = GAME_CONSTANTS.ECONOMY.STAKES[currency];
  const value = Number(amount) / Math.pow(10, config.decimals);
  return `${value.toFixed(currency === "USDC" ? 2 : 4)} ${config.symbol}`;
}

// ============================================
// CLIENT-SIDE x402 UTILITIES (for agents)
// ============================================

/**
 * Creates an x402 payment header for agent API requests
 * Use with CDP AgentKit or any wallet that supports EIP-3009
 * 
 * @param wallet Agent wallet with signing capability
 * @param endpoint The endpoint being accessed
 * @returns Base64-encoded payment header
 */
export async function createX402PaymentHeader(
  wallet: {
    address: string;
    signTypedData: (data: any) => Promise<string>;
  },
  endpoint: AgentEndpoint
): Promise<string> {
  const pricing = PRICING[endpoint];
  const receiptId = crypto.randomUUID();
  const timestamp = Date.now();

  // EIP-3009 transferWithAuthorization payload for USDC
  const payload = {
    receiptId,
    amount: pricing.amount,
    payer: wallet.address,
    timestamp,
  };

  // Sign the payment payload
  const signature = await wallet.signTypedData({
    domain: {
      name: "DetectiveGame",
      version: "1",
      chainId: GAME_CONSTANTS.ECONOMY.CHAIN_ID,
    },
    types: {
      Payment: [
        { name: "receiptId", type: "string" },
        { name: "amount", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    },
    primaryType: "Payment",
    message: {
      receiptId,
      amount: pricing.amount,
      timestamp: BigInt(timestamp),
    },
  });

  const paymentProof = {
    ...payload,
    signature,
  };

  return Buffer.from(JSON.stringify(paymentProof)).toString("base64");
}

/**
 * Example: Making an authenticated + paid agent API request
 * 
 * ```ts
 * const paymentHeader = await createX402PaymentHeader(wallet, "pending");
 * const response = await fetch("/api/agent/pending?fid=123", {
 *   headers: {
 *     "X-Agent-Address": wallet.address,
 *     "X-Agent-Signature": await wallet.signMessage(`pending:123:${Date.now()}`),
 *     "X-Agent-Timestamp": Date.now().toString(),
 *     "X-Payment": paymentHeader,
 *   },
 * });
 * ```
 */
export const X402_EXAMPLES = {
  agentRequest: `
    // 1. Create payment header
    const paymentHeader = await createX402PaymentHeader(wallet, "pending");
    
    // 2. Make authenticated request with payment
    const response = await fetch("/api/agent/pending", {
      headers: {
        "X-Agent-Address": wallet.address,
        "X-Agent-Signature": signature,
        "X-Agent-Timestamp": timestamp,
        "X-Payment": paymentHeader,
      },
    });
  `,
};
