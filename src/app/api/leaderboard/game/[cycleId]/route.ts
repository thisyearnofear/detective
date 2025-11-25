// src/app/api/leaderboard/game/[cycleId]/route.ts
/**
 * Game Results API
 * 
 * Returns the results for a specific game cycle, including
 * player rankings, accuracy, and prizes won.
 */

import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ cycleId: string }> }
) {
    try {
        const { cycleId } = await params;

        if (!cycleId) {
            return NextResponse.json(
                { success: false, error: "Cycle ID is required" },
                { status: 400 }
            );
        }

        // Get game cycle info
        const cycle = await database.getGameCycle(cycleId);
        if (!cycle) {
            return NextResponse.json(
                { success: false, error: "Game cycle not found" },
                { status: 404 }
            );
        }

        // Get results for this cycle
        const results = await database.getGameResultsByCycle(cycleId);

        return NextResponse.json({
            success: true,
            cycle: {
                id: cycle.id,
                chain: cycle.chain,
                state: cycle.state,
                started_at: cycle.started_at,
                ended_at: cycle.ended_at,
                player_count: cycle.player_count,
                entry_fee_wei: cycle.entry_fee_wei,
                prize_pool_wei: cycle.prize_pool_wei,
            },
            results,
            total: results.length,
        });
    } catch (error) {
        console.error("[Leaderboard] Error fetching game results:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch game results" },
            { status: 500 }
        );
    }
}