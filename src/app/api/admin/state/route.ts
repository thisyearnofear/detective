// src/app/api/admin/state/route.ts
// GET /api/admin/state - Get game state and system configuration
// POST /api/admin/state - Transition state, reset, or update config

import { NextRequest, NextResponse } from "next/server";
import {
  getStorageStats,
  isStorageTrackingEnabled,
} from "@/lib/storageTracking";
import { isAdminRequest } from "@/lib/adminAuth";
import type {
  AdminStateRequestBody,
  AdminStateResponse,
  GameConfig,
} from "@/lib/types";

/**
 * GET /api/admin/state
 * Returns current game state, players, bots, and configuration
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
        timestamp: Date.now(),
      },
    };

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
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
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

        return NextResponse.json({
          success: true,
          message: `Transitioned to ${newState}`,
        });
      }

      case "reset": {
        await gameManager.resetGame();
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
