// src/app/api/match/active/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";

/**
 * API route to get all active matches for a player.
 * Returns up to 2 simultaneous matches that are currently active.
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
        { status: 403 },
      );
    }

    // Get all active matches for the player
    const matches = gameManager.getActiveMatches(playerFid);

    // Sanitize matches before sending to client
    const sanitizedMatches = matches.map((match) => ({
      id: match.id,
      opponent: {
        fid: match.opponent.fid,
        username: match.opponent.username,
        displayName: match.opponent.displayName,
        pfpUrl: match.opponent.pfpUrl,
      },
      startTime: match.startTime,
      endTime: match.endTime,
      slotNumber: match.slotNumber,
      roundNumber: match.roundNumber,
      currentVote: match.currentVote,
      voteLocked: match.voteLocked,
      messages: match.messages,
    }));

    // Organize by slot for easier client consumption
    const slots: Record<number, any> = {};
    for (const match of sanitizedMatches) {
      slots[match.slotNumber] = match;
    }

    // Calculate total rounds dynamically based on player pool
    const totalPlayers = gameState.players.size;
    const totalBots = gameState.bots.size;
    const totalOpponents = totalPlayers - 1 + (totalBots - 1);
    const matchesPerRound = gameState.config.simultaneousMatches;
    const maxPossibleRounds = Math.floor(
      gameState.config.gameDurationMs /
        gameState.config.matchDurationMs /
        matchesPerRound,
    );
    const totalRounds = Math.min(
      maxPossibleRounds,
      Math.ceil(totalOpponents / matchesPerRound),
    );

    return NextResponse.json({
      matches: sanitizedMatches,
      slots,
      currentRound: gameState.playerSessions.get(playerFid)?.currentRound || 1,
      totalRounds,
      nextRoundStartTime:
        gameState.playerSessions.get(playerFid)?.nextRoundStartTime,
      playerPool: {
        totalPlayers,
        totalBots,
        totalOpponents,
      },
    });
  } catch (error) {
    console.error("Error fetching active matches:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
