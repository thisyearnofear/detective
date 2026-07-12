import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { GAME_CONSTANTS } from "@/lib/gameConstants";
import type { Bot, Match, Player } from "@/lib/types";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Sanitize a match for the client: hide opponent type / training data
 * so players cannot cheat the detection game.
 */
function sanitizeMatch(match: Match) {
  const publicOpponent: Record<string, unknown> = {
    fid: match.opponent.fid,
    username: match.opponent.username,
    displayName: match.opponent.displayName,
    pfpUrl: match.opponent.pfpUrl,
  };

  // Reveal LLM metadata only after vote lock
  if (match.voteLocked && match.opponent.type === "BOT") {
    const bot = match.opponent as Bot;
    publicOpponent.llmModelId = bot.llmModelId;
    publicOpponent.llmModelName = bot.llmModelName;
  }

  const publicPlayer: Pick<
    Player,
    "fid" | "username" | "displayName" | "pfpUrl" | "type"
  > = {
    fid: match.player.fid,
    username: match.player.username,
    displayName: match.player.displayName,
    pfpUrl: match.player.pfpUrl,
    type: match.player.type,
  };

  return {
    id: match.id,
    startTime: match.startTime,
    endTime: match.endTime,
    messages: match.messages,
    isVotingComplete: match.isVotingComplete,
    isFinished: match.isFinished,
    slotNumber: match.slotNumber,
    roundNumber: match.roundNumber,
    currentVote: match.currentVote,
    voteHistory: match.voteHistory,
    voteLocked: match.voteLocked,
    lastPlayerMessageTime: match.lastPlayerMessageTime,
    typingIndicator: match.typingIndicator,
    stakedAmount: match.stakedAmount,
    stakeCurrency: match.stakeCurrency,
    isStaked: match.isStaked,
    player: publicPlayer,
    opponent: publicOpponent,
  };
}

/**
 * GET /api/match/active?fid=
 *
 * Returns the player's active matches for the current LIVE cycle.
 * Creates new round matches as needed via gameManager.getActiveMatches.
 */
export async function GET(request: NextRequest) {
  try {
    return await logger.time("/api/match/active", "GET", async () => {
      const fidParam = request.nextUrl.searchParams.get("fid");
      if (!fidParam) {
        return NextResponse.json({ error: "fid is required." }, { status: 400 });
      }

      const fid = parseInt(fidParam, 10);
      if (isNaN(fid)) {
        return NextResponse.json({ error: "Invalid fid." }, { status: 400 });
      }

      const gameState = await gameManager.getGameState();

      if (gameState.state !== "LIVE") {
        return NextResponse.json(
          { error: "Game is not live.", currentState: gameState.state },
          { status: 403 },
        );
      }

      const matches = await gameManager.getActiveMatches(fid);
      const rawState = await gameManager.getRawState();
      const session = rawState.playerSessions.get(fid);
      const player = rawState.players.get(fid);

      const leaderboard = await gameManager.getLeaderboard();
      const rankIndex = leaderboard.findIndex((e) => e.player.fid === fid);
      const playerRank = rankIndex >= 0 ? rankIndex + 1 : undefined;

      return NextResponse.json({
        matches: matches.map(sanitizeMatch),
        currentRound: session?.currentRound || 1,
        totalRounds: GAME_CONSTANTS.FIXED_ROUNDS,
        cycleId: gameState.cycleId,
        serverTime: Date.now(),
        voteHistory: player?.voteHistory || [],
        playerRank,
        totalPlayers: gameState.playerCount,
        currentState: gameState.state,
      });
    });
  } catch (error) {
    logger.error("[api/match/active] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
