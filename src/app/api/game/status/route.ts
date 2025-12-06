// src/app/api/game/status/route.ts
/**
 * Consolidated Game Status API
 * 
 * Returns combined game state, phase info, and player list in a single request.
 * This consolidates what would normally be 2-3 separate polling requests.
 * 
 * Usage: /api/game/status?cycleId=xxx&fid=yyy
 */

import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");

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
      isRegistered,

      // Phase info (replaces separate /api/game/phase call)
      phase,
      phaseEndTime,
      reason,

      // Players list (replaces separate /api/game/players call)
      players,
    };

    return NextResponse.json(clientState);
  } catch (error) {
    console.error("Error fetching game status:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}