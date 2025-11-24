// src/app/api/match/next/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";

/**
 * API route to get the next match for a player.
 * Expects a GET request with a `fid` query parameter.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");

    if (!fid) {
      return NextResponse.json({ error: "FID is required." }, { status: 400 });
    }

    const playerFid = parseInt(fid, 10);
    if (isNaN(playerFid)) {
      return NextResponse.json({ error: "Invalid FID." }, { status: 400 });
    }

    const gameState = gameManager.getGameState();
    if (gameState.state !== "LIVE") {
      return NextResponse.json(
        { error: "The game is not currently live." },
        { status: 403 }
      );
    }

    const match = gameManager.createNextMatch(playerFid);

    if (!match) {
      return NextResponse.json(
        { error: "Could not find or create a match for the player." },
        { status: 404 }
      );
    }

    // Sanitize the opponent object before sending it to the client.
    // The client should not know if the opponent is a 'REAL' user or a 'BOT'.
    const sanitizedOpponent = {
      fid: match.opponent.fid,
      username: match.opponent.username,
      displayName: match.opponent.displayName,
      pfpUrl: match.opponent.pfpUrl,
    };

    const sanitizedMatch = {
      id: match.id,
      opponent: sanitizedOpponent,
      startTime: match.startTime,
      endTime: match.endTime,
    };

    return NextResponse.json(sanitizedMatch);
  } catch (error) {
    console.error("Error creating next match:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}