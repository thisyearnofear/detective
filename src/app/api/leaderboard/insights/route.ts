import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

function defaultInsights(): object {
  return {
    personalRank: 0,
    totalPlayers: 0,
    percentile: 0,
    recentTrend: "stable" as const,
    strengthArea: "consistency" as const,
    weaknessArea: "speed" as const,
    nextMilestone: {
      type: "achievement" as const,
      target: "Play your first game",
      progress: 0,
    },
    competitiveAnalysis: {
      beatenRecently: [],
      lostToRecently: [],
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidStr = searchParams.get("fid");

    if (!fidStr) {
      return NextResponse.json(
        { error: "Missing required parameter: fid" },
        { status: 400 }
      );
    }

    const fid = parseInt(fidStr);
    if (isNaN(fid)) {
      return NextResponse.json(
        { error: "Invalid fid parameter" },
        { status: 400 }
      );
    }

    const stats = await database.getPlayerStats(fid);

    if (!stats) {
      return NextResponse.json(defaultInsights(), {
        headers: RESPONSE_HEADERS,
      });
    }

    const leaderboard = await database.getGlobalLeaderboard(1000);
    const playerIndex = leaderboard.findIndex((e) => e.fid === fid);
    const totalPlayers = leaderboard.length;
    const personalRank = playerIndex >= 0 ? playerIndex + 1 : totalPlayers + 1;
    const percentile =
      totalPlayers > 0
        ? Math.round(((totalPlayers - personalRank + 1) / totalPlayers) * 100)
        : 0;

    let strengthArea: "speed" | "accuracy" | "consistency" = "consistency";
    let weaknessArea: "speed" | "accuracy" | "consistency" = "speed";

    if (stats.accuracy > 70) {
      strengthArea = "accuracy";
      weaknessArea = stats.avg_speed_ms > 3000 ? "speed" : "consistency";
    } else if (stats.avg_speed_ms < 3000) {
      strengthArea = "speed";
      weaknessArea = stats.accuracy < 50 ? "accuracy" : "consistency";
    } else {
      strengthArea = "consistency";
      weaknessArea = stats.accuracy < 50 ? "accuracy" : "speed";
    }

    let nextMilestone: {
      type: "rank" | "achievement" | "streak";
      target: number | string;
      progress: number;
    };

    if (stats.total_games < 5) {
      nextMilestone = {
        type: "achievement",
        target: "Play 5 games",
        progress: Math.round((stats.total_games / 5) * 100),
      };
    } else if (stats.total_games < 25) {
      nextMilestone = {
        type: "achievement",
        target: "Play 25 games",
        progress: Math.round((stats.total_games / 25) * 100),
      };
    } else if (stats.accuracy < 80) {
      nextMilestone = {
        type: "achievement",
        target: "Reach 80% accuracy",
        progress: Math.round((stats.accuracy / 80) * 100),
      };
    } else if (personalRank > 10) {
      nextMilestone = {
        type: "rank",
        target: 10,
        progress: Math.round(
          ((totalPlayers - personalRank) / (totalPlayers - 10)) * 100
        ),
      };
    } else {
      nextMilestone = {
        type: "rank",
        target: 1,
        progress: Math.round(((10 - personalRank) / 9) * 100),
      };
    }

    nextMilestone.progress = Math.max(0, Math.min(100, nextMilestone.progress));

    return NextResponse.json(
      {
        personalRank,
        totalPlayers,
        percentile,
        recentTrend: "stable" as const,
        strengthArea,
        weaknessArea,
        nextMilestone,
        competitiveAnalysis: {
          beatenRecently: [],
          lostToRecently: [],
        },
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    console.error("[Leaderboard Insights] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch player insights" },
      { status: 500 }
    );
  }
}
