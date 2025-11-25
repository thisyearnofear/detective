// src/app/api/game/status/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to get the current status of the game cycle.
 * Handles GET requests.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");
    // Use async version for proper Redis loading in production
    const fullState = await gameManager.getGameStateAsync();

    let isRegistered = false;
    if (fidParam) {
      const fid = parseInt(fidParam, 10);
      if (!isNaN(fid)) {
        isRegistered = fullState.players.has(fid);
      }
    }

    // Return a simplified version of the state for clients
    const clientState = {
      cycleId: fullState.cycleId,
      state: fullState.state,
      playerCount: fullState.players.size,
      registrationEnds: fullState.registrationEnds,
      gameEnds: fullState.gameEnds,
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