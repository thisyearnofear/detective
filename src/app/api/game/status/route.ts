// src/app/api/game/status/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { startBotResponseDelivery } from "@/lib/botResponseDelivery";

/**
 * Start bot response delivery service on first request
 */
if (typeof globalThis !== "undefined" && typeof window === "undefined") {
  const globalAny = globalThis as any;
  if (!globalAny.__BOT_DELIVERY_STARTED__) {
    globalAny.__BOT_DELIVERY_STARTED__ = true;
    startBotResponseDelivery();
  }
}

/**
 * API route to get the current status of the game cycle.
 * Handles GET requests.
 */
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

    // Return a simplified version of the state for clients
    const clientState = {
      cycleId: gameState.cycleId,
      state: gameState.state,
      playerCount: gameState.playerCount,
      registrationEnds: gameState.registrationEnds,
      gameEnds: gameState.gameEnds,
      isRegistered, // Add this field
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