// src/app/api/leaderboard/current/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

export const dynamic = "force-dynamic";

/**
 * API route to get the current leaderboard.
 * Handles GET requests.
 */
export async function GET() {
  try {
    const gameState = await gameManager.getGameState();
    const rawState = await gameManager.getRawState();

    // If the game is finished, return the stored final leaderboard.
    // Otherwise, calculate and return a provisional one.
    const leaderboard =
      gameState.state === "FINISHED"
        ? rawState.leaderboard
        : await gameManager.getLeaderboard();

    return NextResponse.json(leaderboard, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
