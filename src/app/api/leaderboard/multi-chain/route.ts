// src/app/api/leaderboard/multi-chain/route.ts
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";

type Chain = 'arbitrum' | 'monad';
type LeaderboardType = 'current-game' | 'season' | 'all-time' | 'nft-holders' | 'token-holders';
type TimeFrame = '24h' | '7d' | '30d' | 'all';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = (searchParams.get("chain") || "arbitrum") as Chain;
    const type = (searchParams.get("type") || "current-game") as LeaderboardType;
    const timeframe = (searchParams.get("timeframe") || "7d") as TimeFrame;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    // Get leaderboard data based on parameters
    let leaderboardData;
    
    switch (type) {
      case 'current-game':
        // Current active game leaderboard
        leaderboardData = await database.getCurrentGameLeaderboard(chain, limit);
        break;
        
      case 'season':
        // Season-based rankings with time frame
        leaderboardData = await database.getSeasonLeaderboard(chain, timeframe, limit);
        break;
        
      case 'all-time':
        // All-time rankings
        leaderboardData = await database.getAllTimeLeaderboard(chain, limit);
        break;
        
      case 'nft-holders':
        // NFT holder specific rankings
        leaderboardData = await database.getNFTHolderLeaderboard(chain, timeframe, limit);
        break;
        
      case 'token-holders':
        // Token holder specific rankings (mainly for Monad)
        leaderboardData = await database.getTokenHolderLeaderboard(chain, timeframe, limit);
        break;
        
      default:
        leaderboardData = await database.getCurrentGameLeaderboard(chain, limit);
    }

    // Get chain statistics
    const chainStats = {
      arbitrum: await getChainStats('arbitrum'),
      monad: await getChainStats('monad')
    };

    // Get cross-chain rankings (top performers across both chains)
    const crossChainRankings = await database.getCrossChainLeaderboard(50);

    return NextResponse.json({
      success: true,
      arbitrum: chain === 'arbitrum' ? leaderboardData : [],
      monad: chain === 'monad' ? leaderboardData : [],
      chainStats,
      crossChainRankings,
      metadata: {
        chain,
        type,
        timeframe,
        total: leaderboardData?.length || 0,
      }
    });

  } catch (error) {
    console.error("[MultiChainLeaderboard] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch multi-chain leaderboard" },
      { status: 500 }
    );
  }
}

async function getChainStats(chain: Chain) {
  try {
    // This would query actual chain data
    // For now, return mock data structure
    return {
      chain,
      totalPlayers: Math.floor(Math.random() * 1000) + 500,
      totalGames: Math.floor(Math.random() * 5000) + 1000,
      nftHolders: Math.floor(Math.random() * 200) + 50,
      tokenHolders: chain === 'monad' ? Math.floor(Math.random() * 800) + 200 : undefined,
      topAccuracy: 95.5 + Math.random() * 4,
      avgAccuracy: 65.0 + Math.random() * 15,
    };
  } catch (error) {
    console.error(`[ChainStats] Error getting stats for ${chain}:`, error);
    return null;
  }
}