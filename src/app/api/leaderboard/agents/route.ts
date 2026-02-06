import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    const agents = await database.getAgentLeaderboard(limit);

    return NextResponse.json(
      {
        success: true,
        data: agents,
        metadata: {
          limit,
          metric: "DSR",
          minMatches: 5,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[AgentLeaderboard] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch agent leaderboard" },
      { status: 500 }
    );
  }
}
