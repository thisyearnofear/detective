// src/app/api/stats/player/[fid]/route.ts
/**
 * Player Stats API
 * 
 * Returns detailed statistics for a specific player,
 * including their game history and performance metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ fid: string }> }
) {
    try {
        const { fid: fidStr } = await params;
        const fid = parseInt(fidStr);

        if (isNaN(fid)) {
            return NextResponse.json(
                { success: false, error: "Invalid FID" },
                { status: 400 }
            );
        }

        // Get player stats
        const stats = await database.getPlayerStats(fid);
        if (!stats) {
            return NextResponse.json(
                { success: false, error: "Player not found" },
                { status: 404 }
            );
        }

        // Get recent game results
        const recentGames = await database.getGameResultsByPlayer(fid, 10);

        // Get recent matches
        const recentMatches = await database.getMatchesByPlayer(fid, 20);

        return NextResponse.json({
            success: true,
            player: {
                fid: stats.fid,
                username: stats.username,
                display_name: stats.display_name,
                pfp_url: stats.pfp_url,
            },
            stats: {
                total_games: stats.total_games,
                total_matches: stats.total_matches,
                correct_votes: stats.correct_votes,
                accuracy: stats.accuracy,
                avg_speed_ms: stats.avg_speed_ms,
                best_streak: stats.best_streak,
                last_played_at: stats.last_played_at,
            },
            recentGames,
            recentMatches: recentMatches.map(m => ({
                id: m.id,
                cycle_id: m.cycle_id,
                opponent_type: m.opponent_type,
                vote: m.vote,
                is_correct: m.is_correct,
                vote_speed_ms: m.vote_speed_ms,
                started_at: m.started_at,
            })),
        });
    } catch (error) {
        console.error("[Stats] Error fetching player stats:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch player stats" },
            { status: 500 }
        );
    }
}