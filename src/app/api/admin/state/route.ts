// src/app/api/admin/state/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * Admin API to manually control game state transitions.
 * POST: Transition to a new state
 * GET: Get current state with all data
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, state } = body;

        if (action === "transition" && state) {
            // Force transition first, then get state for response
            // Don't call getGameState before - it might trigger auto-transitions
            await gameManager.forceStateTransition(state);
            // Wait a bit for Redis to sync
            await new Promise(resolve => setTimeout(resolve, 100));
            const gameState = await gameManager.getGameState();
            return NextResponse.json({
                success: true,
                message: `Game state transitioned to ${state}`,
                gameState,
            });
        }

        if (action === "reset") {
            // Await the async reset to ensure Redis is cleared
            await gameManager.resetGame();
            return NextResponse.json({
                success: true,
                message: "Game reset successfully",
                gameState: await gameManager.getGameState(),
            });
        }

        if (action === "update-config" && body.config) {
            await gameManager.updateConfig(body.config);
            return NextResponse.json({
                success: true,
                message: "Config updated successfully",
                gameState: await gameManager.getGameState(),
            });
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Error in admin state control:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        // Use async version for proper Redis loading in production
        const gameState = await gameManager.getGameState();
        const players = await gameManager.getAllPlayers();
        const bots = await gameManager.getAllBots();
        const matches = await gameManager.getAllMatches();

        return NextResponse.json({
            gameState: {
                cycleId: gameState.cycleId,
                state: gameState.state,
                playerCount: players.length,
                botCount: bots.length,
                matchCount: matches.length,
                config: gameState.config,
            },
            players,
            bots,
            matches,
        });
    } catch (error) {
        console.error("Error fetching admin data:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
