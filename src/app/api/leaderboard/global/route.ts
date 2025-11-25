// src/app/api/leaderboard/global/route.ts
/**
 * Global Leaderboard API
 * 
 * Returns the all-time leaderboard sorted by accuracy and speed.
 * Players need at least 5 matches to qualify.
 */

import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

        const leaderboard = await database.getGlobalLeaderboard(limit);

        return NextResponse.json({
            success: true,
            leaderboard,
            total: leaderboard.length,
            minMatchesRequired: 5,
        });
    } catch (error) {
        console.error("[Leaderboard] Error fetching global leaderboard:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}