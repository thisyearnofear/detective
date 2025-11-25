// src/app/api/game/register/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { getFarcasterUserData } from "@/lib/neynar";

/**
 * API route to register a user for the current game cycle.
 * Expects a POST request with a JSON body containing the user's `fid`.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fid } = body;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json({ error: "Invalid FID provided." }, { status: 400 });
    }

    const gameState = await gameManager.getGameState();
    if (gameState.state !== "REGISTRATION") {
      return NextResponse.json(
        { error: "Registration is currently closed." },
        { status: 403 }
      );
    }

    // Fetch all user data from Neynar, including validation, profile, and casts
    const { isValid, userProfile, recentCasts, style } = await getFarcasterUserData(fid);

    if (!isValid || !userProfile) {
      return NextResponse.json(
        { error: "User does not meet the quality criteria to join." },
        { status: 403 }
      );
    }

    // Register the player and create the corresponding bot in the game state
    const player = await gameManager.registerPlayer(userProfile, recentCasts, style);

    if (!player) {
      return NextResponse.json(
        { error: "Failed to register player. The game might be full." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Player registered successfully.",
      player,
    });
  } catch (error) {
    console.error("Error in game registration:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}