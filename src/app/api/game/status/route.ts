// src/app/api/game/status/route.ts
/**
 * Game Status API - Polled frequently by clients
 * 
 * Applies rate limiting for unauthenticated requests to prevent abuse.
 * Authenticated users bypass rate limits.
 */

import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { checkRateLimit, getClientIp, getRateLimitConfig } from "@/lib/rateLimit";
import { withRetry, RETRY_PRESETS } from "@/lib/retry";

export const dynamic = "force-dynamic";

interface GameStatusResponse {
  state: string;
  cycleId: string;
  playerCount: number;
  registrationEnds?: number;
  gameEnds?: number;
  minPlayers: number;
  maxPlayers: number;
  mode: string; // Current game mode
}

/**
 * Apply rate limiting to unauthenticated requests
 */
async function checkApiRateLimit(request: NextRequest, path: string): Promise<boolean> {
  // Skip rate limiting if user is authenticated
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return true; // Allow authenticated requests
  }
  
  // Check rate limit for unauthenticated requests
  const clientIp = getClientIp(request.headers);
  const config = getRateLimitConfig(path);
  const result = await checkRateLimit({
    key: `api:${path}`,
    limit: config.limit,
    window: config.window,
    ip: clientIp,
  });
  
  return result.allowed;
}

export async function GET(request: NextRequest) {
  // Check rate limit first
  const allowed = await checkApiRateLimit(request, "game:status");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Poll with retry for upstream dependencies
  try {
    const gameState = await withRetry(() => gameManager.getGameState(), RETRY_PRESETS.fast);
    const config = await gameManager.getConfig();
    
    const response: GameStatusResponse = {
      state: gameState?.state || "REGISTRATION",
      cycleId: gameState?.cycleId || "unknown",
      playerCount: gameState?.playerCount || 0,
      registrationEnds: gameState?.registrationEnds,
      gameEnds: gameState?.gameEnds,
      minPlayers: 1,
      maxPlayers: 100,
      mode: config?.mode || 'conversation',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[game/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get game status" },
      { status: 500 }
    );
  }
}