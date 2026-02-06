// src/app/api/match/active/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";
import { getJSON, setJSON } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Cache TTL in seconds - shorter because match state changes more frequently
const CACHE_TTL = 1;

/**
 * API route to get all active matches for a player.
 * Returns up to 2 simultaneous matches that are currently active.
 * 
 * SINGLE SOURCE OF TRUTH: This is the only endpoint that returns match state.
 * Bot responses are delivered inline via /api/chat/send, not here.
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

    // Try to get cached response first (prevent cold start delays)
    const cacheKey = `api:match:active:${playerFid}`;
    const cached = await getJSON<Record<string, any>>(cacheKey);
    
    // Only use cache if it's fresh
    if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL * 1000) {
      const { _cachedAt, ...responseData } = cached;
      return NextResponse.json(responseData, {
        headers: { "X-Cache": "HIT", "Cache-Control": "no-store" }
      });
    }

    const gameState = await gameManager.getGameState();
    const rawState = await gameManager.getRawState();

    console.log(`[/api/match/active] FID: ${playerFid}, State: ${gameState.state}, Players: ${gameState.playerCount}, GameEnds: ${new Date(gameState.gameEnds).toISOString()}`);

    if (gameState.state !== "LIVE" && gameState.state !== "FINISHED") {
      console.log(`[/api/match/active] Returning 403 - game state is ${gameState.state}, not LIVE or FINISHED`);
      return NextResponse.json(
        { error: "The game is not currently live.", currentState: gameState.state },
        { status: 403 },
      );
    }

    // Get all active matches for the player
    const matches = await gameManager.getActiveMatches(playerFid);

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
      isOpponentTyping: match.typingIndicator?.isTyping ?? false,
    }));

    // Organize by slot for easier client consumption
    const slots: Record<number, any> = {};
    for (const match of sanitizedMatches) {
      slots[match.slotNumber] = match;
    }

    // Calculate total rounds dynamically based on player pool
    const totalRounds = gameManager.getTotalRounds();

    // Calculate leaderboard position for this player (only available after game ends)
    let playerRank = 0;
    if (rawState.leaderboard && rawState.leaderboard.length > 0) {
      const rankIndex = rawState.leaderboard.findIndex(
        (entry) => entry.player.fid === playerFid
      );
      playerRank = rankIndex >= 0 ? rankIndex + 1 : 0;
    }

    const player = rawState.players.get(playerFid);
    const voteHistory = player ? player.voteHistory : [];

    const responseData = {
      matches: sanitizedMatches,
      slots,
      currentRound: rawState.playerSessions.get(playerFid)?.currentRound || 1,
      totalRounds,
      playerRank,
      totalPlayers: gameState.playerCount,
      gameState: gameState.state,
      // Include cycleId for shared channel optimization
      cycleId: gameState.cycleId,
      voteHistory,
      // Server time for client synchronization
      serverTime: Date.now(),
      // Config for feature toggles
      config: rawState.config,
    };

    // Cache the response
    await setJSON(cacheKey, { ...responseData, _cachedAt: Date.now() }, CACHE_TTL);

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
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
