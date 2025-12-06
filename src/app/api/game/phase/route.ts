// src/app/api/game/phase/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to get the current phase and transition state.
 * Used by GameLobby to drive phase transitions server-side.
 * 
 * Replaces client-side setTimeout magic with server-driven state.
 * Polls every 1s to check if phase should transition.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    // Note: fid is for potential future use (player-specific phase data)

    const gameState = await gameManager.getGameState();
    const rawState = await gameManager.getRawState();

    // Validate cycle matches current
    if (cycleId && cycleId !== gameState.cycleId) {
      return NextResponse.json(
        { error: "Game cycle has changed" },
        { status: 410 } // Gone - resource no longer available
      );
    }

    const now = Date.now();
    const playerCount = rawState.players.size;
    const registrationActive = gameState.state === "REGISTRATION";
    const gameActive = gameState.state === "LIVE";
    const isFinished = gameState.state === "FINISHED";

    // Determine current phase and transition readiness
    let phase = "UNKNOWN";
    let transitionReady = false;
    let nextPhaseTime = 0;
    let reason = "";

    // Registration phase logic
    if (registrationActive) {
      phase = "REGISTRATION";

      // Check if game should start
      const minPlayersReached = playerCount >= 3;
      const maxPlayersReached = playerCount >= 50;
      const registrationTimeUp = now >= gameState.registrationEnds;

      if ((minPlayersReached || maxPlayersReached) && registrationTimeUp) {
        transitionReady = true;
        phase = "BOT_GENERATION";
        reason = `Game ready: ${playerCount} players, registration closed`;
      } else if (minPlayersReached && !registrationTimeUp) {
        // Count down but don't transition yet
        nextPhaseTime = gameState.registrationEnds - now;
        reason = `${playerCount} players registered, waiting for registration close (${Math.ceil(nextPhaseTime / 1000)}s)`;
      } else {
        nextPhaseTime = gameState.registrationEnds - now;
        reason = `Waiting for minimum ${3} players (currently ${playerCount}), ${Math.ceil(nextPhaseTime / 1000)}s left`;
      }
    }

    // Live game phase
    if (gameActive) {
      phase = "LIVE";
      const timeRemaining = gameState.gameEnds - now;
      reason =
        timeRemaining > 0
          ? `Game in progress: ${Math.ceil(timeRemaining / 1000)}s remaining`
          : "Game should be finishing";
    }

    // Finished phase
    if (isFinished) {
      phase = "FINISHED";
      reason = "Game finished, waiting for next cycle";
    }

    // Build response
    const response = {
      phase,
      cycleId: gameState.cycleId,
      phaseStartTime: gameState.registrationEnds - (gameState.state === "REGISTRATION" ? 30000 : 0), // Estimate
      phaseEndTime:
        gameState.state === "REGISTRATION"
          ? gameState.registrationEnds
          : gameState.state === "LIVE"
            ? gameState.gameEnds
            : 0,
      transitionReady,
      transitionState: {
        playerCount,
        registrationActive,
        gameActive,
        isFinished,
        error: null as string | null,
      },
      reason,
      serverTime: now,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching game phase:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch game phase",
        phase: "UNKNOWN",
        transitionReady: false,
        transitionState: {
          error: (error as any).message,
        },
      },
      { status: 500 }
    );
  }
}
