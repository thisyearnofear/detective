// src/app/api/game/status/route.ts
/**
 * Consolidated Game Status API
 * 
 * Returns combined game state, phase info, and player list in a single request.
 * Also triggers game state tick for phase transitions (client-driven).
 * 
 * Usage: /api/game/status?cycleId=xxx&fid=yyy
 */

import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { getJSON, setJSON } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Cache TTL in seconds - short because game state changes frequently
const CACHE_TTL = 1;

export async function GET(request: Request) {
   try {
     const { searchParams } = new URL(request.url);
     const fidParam = searchParams.get("fid");
     
     // Try to get cached response first (prevent cold start delays)
     const cacheKey = `api:game:status:${fidParam || 'anon'}`;
     const cached = await getJSON<Record<string, any>>(cacheKey);
     
     // Only use cache if it's fresh (less than CACHE_TTL seconds old)
     // This prevents cold start from blocking every request
     if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL * 1000) {
       const { _cachedAt, ...responseData } = cached;
       return NextResponse.json(responseData, {
         headers: { "X-Cache": "HIT", "Cache-Control": "no-store" }
       });
     }
     
     // Tick game state for phase transitions (ididempotent, handles its own rate limiting)
     await gameManager.tickGameState();
     
     const gameState = await gameManager.getGameState();
     const rawState = await gameManager.getRawState();

    let isRegistered = false;
    if (fidParam) {
      const fid = parseInt(fidParam, 10);
      if (!isNaN(fid)) {
        isRegistered = rawState.players.has(fid);
      }
    }

    // Get players list from raw state
    const players = Array.from(rawState.players.values()).map((player) => ({
      fid: player.fid,
      username: player.username,
      displayName: player.displayName,
      pfpUrl: player.pfpUrl,
      isRegistered: true,
    }));

    // Get phase info (consolidation of /api/game/phase data)
    let phase = gameState.state;
    let phaseEndTime = gameState.registrationEnds;
    let reason = "";

    if (gameState.state === "REGISTRATION") {
       phase = "REGISTRATION";
       phaseEndTime = gameState.registrationEnds;
       reason = `Waiting for players... (${gameState.playerCount}/8)`;
     } else if (gameState.state === "LIVE") {
       phase = "LIVE";
       phaseEndTime = gameState.gameEnds;
       reason = "Game is live";
     } else if (gameState.state === "FINISHED") {
       phase = "FINISHED";
       phaseEndTime = gameState.gameEnds;
       reason = "Game finished";
     }

      // Return consolidated state: game info + phase + players
      const clientState = {
        // Game state (original)
        cycleId: gameState.cycleId,
        state: gameState.state,
        playerCount: gameState.playerCount,
       registrationEnds: gameState.registrationEnds,
       gameEnds: gameState.gameEnds,
       finishedAt: gameState.finishedAt, // For calculating next cycle countdown
       isRegistered,

       // Phase info (replaces separate /api/game/phase call)
       phase,
       phaseEndTime,
       reason,

       // Configuration (for toggling features like monetization)
       config: rawState.config,

       // Players list (replaces separate /api/game/players call)
       players,
      };

      // Cache the response for CACHE_TTL seconds (prevents cold start delays)
      const cacheableResponse = { ...clientState, _cachedAt: Date.now() };
      await setJSON(cacheKey, cacheableResponse, CACHE_TTL);

     return NextResponse.json(clientState, {
       headers: {
         "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
       },
     });
  } catch (error) {
    console.error("Error fetching game status:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
