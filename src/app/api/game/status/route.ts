// src/app/api/game/status/route.ts
/**
 * Game Status API - Polled frequently by clients
 * 
 * Applies rate limiting for unauthenticated requests to prevent abuse.
 * Authenticated users bypass rate limits.
 * 
 * PERFORMANCE: Server-side caching reduces Redis calls
 */

import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { checkRateLimit, getClientIp, getRateLimitConfig } from "@/lib/rateLimit";
import { withRetry, RETRY_PRESETS } from "@/lib/retry";
import { getCached, CACHE_TTL } from "@/lib/performanceCache";

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
  isRegistered?: boolean;
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

  // Extract FID from query params for registration check
  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : null;

  // Poll with retry for upstream dependencies + caching
  try {
    // Use cache key that includes FID if present (for isRegistered check)
    const cacheKey = fid ? `game:status:${fid}` : "game:status";
    
    const response = await getCached<GameStatusResponse>(
      cacheKey,
      async () => {
        const gameState = await withRetry(() => gameManager.getGameState(), RETRY_PRESETS.fast);
        const config = await gameManager.getConfig();
        
        // Check registration status if FID provided
        let isRegistered = false;
        if (fid && !isNaN(fid)) {
          isRegistered = await gameManager.isPlayerRegistered(fid);
        }
        
        return {
          state: gameState?.state || "REGISTRATION",
          cycleId: gameState?.cycleId || "unknown",
          playerCount: gameState?.playerCount || 0,
          registrationEnds: gameState?.registrationEnds,
          gameEnds: gameState?.gameEnds,
          minPlayers: 1,
          maxPlayers: 100,
          mode: config?.mode || 'conversation',
          isRegistered: fid ? isRegistered : undefined,
        };
      },
      CACHE_TTL.GAME_STATE
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[game/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get game status" },
      { status: 500 }
    );
  }
}