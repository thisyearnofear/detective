// src/app/api/leaderboard/current/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to get the current leaderboard.
 * Handles GET requests.
 */
export async function GET() {
  try {
    const gameState = gameManager.getGameState();

    // If the game is finished, return the stored final leaderboard.
    // Otherwise, calculate and return a provisional one.
    const leaderboard =
      gameState.state === "FINISHED"
        ? gameState.leaderboard
        : gameManager.getLeaderboard();

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}