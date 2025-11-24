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
            gameManager.forceStateTransition(state);
            return NextResponse.json({
                success: true,
                message: `Game state transitioned to ${state}`,
                gameState: gameManager.getGameState(),
            });
        }

        if (action === "reset") {
            gameManager.resetGame();
            return NextResponse.json({
                success: true,
                message: "Game reset successfully",
                gameState: gameManager.getGameState(),
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
        const gameState = gameManager.getGameState();
        const players = gameManager.getAllPlayers();
        const bots = gameManager.getAllBots();
        const matches = gameManager.getAllMatches();

        return NextResponse.json({
            gameState: {
                cycleId: gameState.cycleId,
                state: gameState.state,
                playerCount: players.length,
                botCount: bots.length,
                matchCount: matches.length,
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
