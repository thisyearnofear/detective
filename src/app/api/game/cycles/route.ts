// src/app/api/game/cycles/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to get the list of available game cycles.
 * In the current MVP, this will always return only the single, active cycle.
 * Handles GET requests.
 */
export async function GET() {
  try {
    const gameState = await gameManager.getGameState();

    // For the MVP, we only have one cycle. This can be expanded later.
    const availableCycles = [
      {
        id: gameState.cycleId,
        state: gameState.state,
        playerCount: gameState.playerCount,
        registrationEnds: gameState.registrationEnds,
        gameEnds: gameState.gameEnds,
      },
    ];

    return NextResponse.json(availableCycles);
  } catch (error) {
    console.error("Error fetching game cycles:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}