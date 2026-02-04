/**
 * Agent Leaderboard API (Adversarial Rankings)
 * 
 * Returns the rankings of bots and humans sorted by Deception Success Rate (DSR).
 * DSR measures how often an interrogator was fooled into thinking the subject was real.
 */

import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

        const leaderboard = await database.getAgentLeaderboard(limit);

        return NextResponse.json({
            success: true,
            leaderboard,
            total: leaderboard.length,
            minDeceptionsRequired: 5,
            metric: "DSR (Deception Success Rate)"
        });
    } catch (error) {
        console.error("[AgentLeaderboard] Error fetching rankings:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch agent leaderboard" },
            { status: 500 }
        );
    }
}
