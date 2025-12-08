// src/app/api/stats/career/route.ts
import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { NextRequest } from "next/server";

const GAMES_PER_PAGE = 10;

/**
 * API route to get career statistics for a player.
 * Supports pagination and time-based filtering.
 * 
 * Query params:
 * - fid: player FID (required)
 * - timeFilter: 'week' | 'month' | 'all' (default: 'all')
 * - limit: results per page (default: 10)
 * - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");
    const timeFilter = searchParams.get("timeFilter") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || `${GAMES_PER_PAGE}`, 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!fid) {
      return NextResponse.json({ error: "FID is required." }, { status: 400 });
    }

    const playerFid = parseInt(fid, 10);
    if (isNaN(playerFid)) {
      return NextResponse.json({ error: "Invalid FID." }, { status: 400 });
    }

    // Fetch all game results (we'll filter in-memory for time periods)
    const allGameResults = await database.getGameResultsByPlayer(playerFid, 200);

    if (!allGameResults || allGameResults.length === 0) {
      return NextResponse.json(
        {
          totalGames: 0,
          overallAccuracy: 0,
          totalVotes: 0,
          totalCorrect: 0,
          bestAccuracy: 0,
          worstAccuracy: 0,
          avgSpeed: 0,
          games: [],
          pagination: { total: 0, offset, limit, hasMore: false },
        },
        { status: 200 }
      );
    }

    // Filter by time period
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const filteredResults = allGameResults.filter((g) => {
      const gameTime = new Date(g.created_at).getTime();
      switch (timeFilter) {
        case "week":
          return gameTime >= weekAgo;
        case "month":
          return gameTime >= monthAgo;
        default:
          return true;
      }
    });

    // Calculate aggregate stats from ALL games (not just filtered page)
    const totalGames = allGameResults.length;
    const totalVotes = allGameResults.reduce((sum, g) => sum + g.total_votes, 0);
    const totalCorrect = allGameResults.reduce((sum, g) => sum + g.correct_votes, 0);
    const overallAccuracy = (totalCorrect / totalVotes) * 100;

    const accuracies = allGameResults.map((g) => g.accuracy);
    const bestAccuracy = Math.max(...accuracies);
    const worstAccuracy = Math.min(...accuracies);

    const avgSpeed =
      allGameResults.reduce((sum, g) => sum + g.avg_speed_ms, 0) / totalGames;

    // Paginate filtered results (newest first)
    const paginatedResults = filteredResults
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit);

    // Build games array with minimal data for list view
    const games = paginatedResults.map((result, idx) => ({
      gameId: result.cycle_id,
      timestamp: new Date(result.created_at).getTime(),
      rank: result.rank,
      totalPlayers: result.total_players,
      accuracy: result.accuracy,
      // Index for display (account for offset)
      displayNumber: totalGames - (offset + idx),
    }));

    return NextResponse.json({
      // Aggregate stats (always from all games)
      totalGames,
      overallAccuracy,
      totalVotes,
      totalCorrect,
      bestAccuracy,
      worstAccuracy,
      avgSpeed,
      // Paginated filtered results
      games,
      pagination: {
        total: filteredResults.length,
        offset,
        limit,
        hasMore: offset + limit < filteredResults.length,
      },
    });
  } catch (error) {
    console.error("Error fetching career stats:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
