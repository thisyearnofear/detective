// src/app/api/game/players/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to get the list of registered players for the current game cycle.
 * Returns an array of registered players with their basic info.
 */
export async function GET() {
  try {
    const rawState = await gameManager.getRawState();
    
    // Convert players map to array with essential info only
    const players = Array.from(rawState.players.values()).map(player => ({
      fid: player.fid,
      username: player.username,
      displayName: player.displayName,
      // Don't expose sensitive data like recent casts or style analysis
    }));

    return NextResponse.json({
      success: true,
      players,
      count: players.length,
    });
  } catch (error) {
    console.error("Error fetching registered players:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}