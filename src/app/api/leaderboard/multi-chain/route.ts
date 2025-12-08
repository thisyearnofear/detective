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
    // Since the game is still in development and not live yet,
    // we return zero stats to avoid showing misleading fake data.
    // In production, this would query actual blockchain data for:
    // - NFT holder counts from Arbitrum contract
    // - Token holder counts from Monad contract  
    // - Player statistics from the database
    // - Game completion metrics
    
    // TODO: Implement real blockchain queries when game launches
    // For now, return honest empty stats to set proper expectations
    return {
      chain,
      totalPlayers: 0,
      totalGames: 0,
      nftHolders: 0,
      tokenHolders: chain === 'monad' ? 0 : undefined,
      topAccuracy: 0,
      avgAccuracy: 0,
    };
  } catch (error) {
    console.error(`[ChainStats] Error getting stats for ${chain}:`, error);
    return null;
  }
}