// src/app/api/game/register/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { validateUser } from "@/lib/neynar";

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

    const gameState = gameManager.getGameState();
    if (gameState.state !== "REGISTRATION") {
      return NextResponse.json(
        { error: "Registration is currently closed." },
        { status: 403 }
      );
    }

    // Validate the user with Neynar
    const { isValid, userProfile } = await validateUser(fid);

    if (!isValid || !userProfile) {
      return NextResponse.json(
        { error: "User does not meet the quality criteria to join." },
        { status: 403 }
      );
    }

    // Register the player in the game state
    const player = gameManager.registerPlayer(userProfile);

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