// src/app/api/leaderboard/mobile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

type ViewMode = 'personal' | 'top' | 'nearby' | 'friends';
type ChainFilter = 'arbitrum' | 'monad' | 'cross-chain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get("fid") || "0");
    const mode = (searchParams.get("mode") || "personal") as ViewMode;
    const chain = (searchParams.get("chain") || "arbitrum") as ChainFilter;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (!fid) {
      return NextResponse.json(
        { success: false, error: "FID is required" },
        { status: 400 }
      );
    }

    let leaderboardEntries = [];
    let personalData = null;

    switch (mode) {
      case 'personal':
        // Get personal performance data
        personalData = await getPersonalData(fid, chain);
        leaderboardEntries = await database.getLeaderboardNearPlayer(fid, chain, 10);
        break;
        
      case 'top':
        // Top performers
        leaderboardEntries = await database.getTopPlayers(chain, limit);
        break;
        
      case 'nearby':
        // Players near user's rank
        leaderboardEntries = await database.getLeaderboardNearPlayer(fid, chain, limit);
        break;
        
      case 'friends':
        // Friends and recent opponents (mock for now)
        leaderboardEntries = await database.getFriendsLeaderboard(fid, chain, limit);
        break;
    }

    return NextResponse.json({
      success: true,
      personal: personalData,
      entries: leaderboardEntries || [],
      metadata: {
        mode,
        chain,
        total: leaderboardEntries?.length || 0,
      }
    });

  } catch (error) {
    console.error("[MobileLeaderboard] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch mobile leaderboard" },
      { status: 500 }
    );
  }
}

async function getPersonalData(fid: number, chain: ChainFilter) {
  try {
    // Mock personal data - replace with real database queries
    // Using parameters to avoid unused variable error
    console.log(`Getting personal data for FID: ${fid}, chain: ${chain}`);
    return {
      rank: Math.floor(Math.random() * 100) + 1,
      percentile: Math.floor(Math.random() * 100) + 1,
      recentChange: Math.floor(Math.random() * 20) - 10,
      nextMilestone: "Reach top 50 players",
    };
  } catch (error) {
    console.error("Error getting personal data:", error);
    return null;
  }
}