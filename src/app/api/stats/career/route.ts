// src/app/api/stats/career/route.ts
import { NextResponse } from "next/server";
import { unifiedGameManager as gameManager } from "@/lib/gameManagerUnified";
import { NextRequest } from "next/server";

/**
 * API route to get career statistics for a player.
 * Currently returns data from in-memory state; in production would query a database.
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

    const players = await gameManager.getAllPlayers();
    const player = players.find((p) => p.fid === playerFid);
    if (!player) {
      return NextResponse.json(
        {
          totalGames: 0,
          overallAccuracy: 0,
          totalVotes: 0,
          totalCorrect: 0,
          bestAccuracy: 0,
          worstAccuracy: 0,
          avgSpeed: 0,
          leaderboardHistory: [],
        },
        { status: 200 }
      );
    }

    const voteHistory = player.voteHistory || [];

    if (voteHistory.length === 0) {
      return NextResponse.json(
        {
          totalGames: 0,
          overallAccuracy: 0,
          totalVotes: 0,
          totalCorrect: 0,
          bestAccuracy: 0,
          worstAccuracy: 0,
          avgSpeed: 0,
          leaderboardHistory: [],
        },
        { status: 200 }
      );
    }

    // Calculate stats
    const totalVotes = voteHistory.length;
    const totalCorrect = voteHistory.filter((v) => v.correct && !v.forfeit).length;
    const overallAccuracy = (totalCorrect / totalVotes) * 100;

    // Calculate best and worst accuracy per game (assuming 5 votes per game)
    const votesPerGame = 5;
    const gameCount = Math.ceil(totalVotes / votesPerGame);
    const gameAccuracies: number[] = [];

    for (let i = 0; i < gameCount; i++) {
      const gameVotes = voteHistory.slice(
        i * votesPerGame,
        (i + 1) * votesPerGame
      );
      const gameCorrect = gameVotes.filter(
        (v) => v.correct && !v.forfeit
      ).length;
      const gameAccuracy = (gameCorrect / gameVotes.length) * 100;
      gameAccuracies.push(gameAccuracy);
    }

    const bestAccuracy = Math.max(...gameAccuracies, 0);
    const worstAccuracy = Math.min(...gameAccuracies, 0);

    // Calculate average speed for correct votes
    const correctVotes = voteHistory.filter((v) => v.correct && !v.forfeit);
    const avgSpeed =
      correctVotes.length > 0
        ? correctVotes.reduce((sum, v) => sum + v.speed, 0) / correctVotes.length
        : 0;

    // Get leaderboard history from current game state
    // Note: In production, this would be queried from database with historical records
    const leaderboard = await gameManager.getLeaderboard();
    const playerLeaderboardEntry = leaderboard.find(
      (entry) => entry.player.fid === playerFid
    );

    // Use async version for proper Redis loading in production
    const gameState = await gameManager.getGameState();
    const leaderboardHistory = playerLeaderboardEntry
      ? [
        {
          gameId: gameState.cycleId,
          timestamp: Date.now(),
          rank: leaderboard.indexOf(playerLeaderboardEntry) + 1,
          totalPlayers: leaderboard.length,
          accuracy: playerLeaderboardEntry.accuracy,
        },
      ]
      : [];

    return NextResponse.json({
      totalGames: gameCount,
      overallAccuracy,
      totalVotes,
      totalCorrect,
      bestAccuracy,
      worstAccuracy,
      avgSpeed,
      leaderboardHistory,
    });
  } catch (error) {
    console.error("Error fetching career stats:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
