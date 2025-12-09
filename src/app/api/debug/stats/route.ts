// src/app/api/debug/stats/route.ts
import { NextResponse, NextRequest } from "next/server";
import { database } from "@/lib/database";

/**
 * DEBUG ENDPOINT - Check if database is configured and inspect game results
 * 
 * Query params:
 * - fid: player FID to lookup
 * - token: debug token for access control
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");
    const token = searchParams.get("token");

    // Basic access control
    if (token !== "debug-detective-2024") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!fid) {
      return NextResponse.json({ error: "FID is required" }, { status: 400 });
    }

    const playerFid = parseInt(fid, 10);
    if (isNaN(playerFid)) {
      return NextResponse.json({ error: "Invalid FID" }, { status: 400 });
    }

    // Check environment
    const databaseUrl = process.env.DATABASE_URL;
    const useDatabase = process.env.USE_DATABASE === "true" && databaseUrl;

    console.log(`[DEBUG] Database config:`, {
      hasUrl: !!databaseUrl,
      isEnabled: useDatabase,
      urlPattern: databaseUrl ? `${databaseUrl.substring(0, 50)}...` : "none",
    });

    // Try to fetch game results
    const gameResults = await database.getGameResultsByPlayer(playerFid, 100);

    console.log(`[DEBUG] Retrieved ${gameResults.length} game results for FID ${playerFid}`);

    return NextResponse.json({
      debug: {
        databaseConfigured: useDatabase,
        databaseUrlPresent: !!databaseUrl,
      },
      player: {
        fid: playerFid,
        gameResultsCount: gameResults.length,
      },
      recentGames: gameResults.slice(0, 5).map(g => ({
        cycleId: g.cycle_id,
        rank: g.rank,
        accuracy: g.accuracy,
        correctVotes: g.correct_votes,
        totalVotes: g.total_votes,
        totalPlayers: g.total_players,
        createdAt: g.created_at,
      })),
      allGames: gameResults.map(g => ({
        cycleId: g.cycle_id,
        rank: g.rank,
        accuracy: g.accuracy,
        totalPlayers: g.total_players,
        createdAt: new Date(g.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error("[DEBUG] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch debug info",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
