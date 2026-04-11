// src/app/api/admin/state/route.ts
// GET /api/admin/state - Get game state and system configuration
// POST /api/admin/state - Transition state, reset, or update config

import { NextRequest, NextResponse } from "next/server";
import {
  getStorageStats,
  isStorageTrackingEnabled,
} from "@/lib/storageTracking";
import { isAdminRequest } from "@/lib/adminAuth";
import {
  getAdminCache,
  setAdminCache,
  invalidateAdminCache,
  isCacheFresh,
} from "@/lib/adminCache";
import type {
  AdminStateRequestBody,
  AdminStateResponse,
  GameConfig,
} from "@/lib/types";

/**
 * GET /api/admin/state
 * Returns current game state, players, bots, and configuration
 * Uses server-side cache to reduce Redis REST API calls
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    
    // Return cached data if fresh
    const cache = getAdminCache();
    if (cache && isCacheFresh()) {
      return NextResponse.json({
        ...cache.data,
        system: {
          ...cache.data.system,
          timestamp: now,
          cached: true,
        },
      });
    }

    // Fetch fresh data
    const { gameManager } = await import("@/lib/gameState");
    const [gameState, players, bots, matches] = await Promise.all([
      gameManager.getGameState(),
      gameManager.getAllPlayers(),
      gameManager.getAllBots(),
      gameManager.getAllMatches(),
    ]);

    // Get storage stats if enabled
    const storageStats = isStorageTrackingEnabled()
      ? await getStorageStats()
      : null;

    const response: AdminStateResponse = {
      gameState: {
        state: gameState.state,
        cycleId: gameState.cycleId,
        playerCount: gameState.playerCount,
        botCount: bots.length,
        matchCount: matches.length,
        config: gameState.config,
      },
      players,
      bots,
      storage: storageStats,
      system: {
        storachaEnabled: isStorageTrackingEnabled(),
        timestamp: now,
        cached: false,
      },
    };

    // Update cache
    setAdminCache(response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Admin State GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch game state" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/state
 * Actions: transition, reset, update-config
 * Invalidates cache on mutations
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as AdminStateRequestBody;
    const { action, state: newState, config } = body;

    const { gameManager } = await import("@/lib/gameState");

    switch (action) {
      case "transition": {
        if (!newState) {
          return NextResponse.json(
            { error: "State is required" },
            { status: 400 },
          );
        }

        await gameManager.forceStateTransition(newState);
        
        // Invalidate cache
        invalidateAdminCache();

        return NextResponse.json({
          success: true,
          message: `Transitioned to ${newState}`,
        });
      }

      case "reset": {
        await gameManager.resetGame();
        
        // Invalidate cache
        invalidateAdminCache();
        
        return NextResponse.json({
          success: true,
          message: "Game state reset",
        });
      }

      case "update-config": {
        if (!config || typeof config !== "object") {
          return NextResponse.json(
            { error: "Config is required" },
            { status: 400 },
          );
        }

        await gameManager.updateConfig(config as Partial<GameConfig>);
        
        // Invalidate cache
        invalidateAdminCache();

        return NextResponse.json({
          success: true,
          message: "Config updated",
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Admin State POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 },
    );
  }
}
