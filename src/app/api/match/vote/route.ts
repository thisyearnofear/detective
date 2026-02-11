// src/app/api/match/vote/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";

/**
 * API route to update the vote for a specific match.
 * Can be called multiple times during a match to toggle the vote.
 * Also accepts optional LLM guess for bot matches.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, vote, fid, llmGuess } = body;
    console.log(`[/api/match/vote POST] Received vote: ${vote} for match ${matchId} from FID ${fid}${llmGuess ? `, LLM guess: ${llmGuess}` : ""}`);

    if (!matchId || !vote || !fid) {
      return NextResponse.json(
        { error: "matchId, vote, and fid are required." },
        { status: 400 }
      );
    }

    if (vote !== "REAL" && vote !== "BOT") {
      return NextResponse.json(
        { error: "Vote must be either 'REAL' or 'BOT'." },
        { status: 400 }
      );
    }

    const playerFid = parseInt(fid, 10);
    if (isNaN(playerFid)) {
      return NextResponse.json({ error: "Invalid FID." }, { status: 400 });
    }

    // Verify the match belongs to this player (check Redis if not in memory)
    const match = await gameManager.getMatch(matchId);
    if (!match) {
      console.error(`[/api/match/vote POST] Match ${matchId} not found for FID ${playerFid}. Match was likely deleted or never existed.`);
      const rawState = await gameManager.getRawState();
      const allMatches = Array.from(rawState.matches.keys());
      console.log(`[/api/match/vote POST] Currently available matches in memory: ${allMatches.length > 0 ? allMatches.join(', ') : 'NONE'}`);
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    if (match.player.fid !== playerFid) {
      return NextResponse.json(
        { error: "This match does not belong to the specified player." },
        { status: 403 }
      );
    }

    // Update the vote (optionally with LLM guess)
    const updatedMatch = await gameManager.updateMatchVote(matchId, vote, llmGuess);
    console.log(`[/api/match/vote POST] updatedMatch from gameManager:`, updatedMatch ? { currentVote: updatedMatch.currentVote, voteLocked: updatedMatch.voteLocked, userLlmGuess: updatedMatch.userLlmGuess } : null);

    if (!updatedMatch) {
      return NextResponse.json(
        { error: "Could not update vote. Match may be locked." },
        { status: 400 }
      );
    }

    // Check if we should auto-lock (time is up)
    const now = Date.now();
    let isCorrect = null;

    if (now >= updatedMatch.endTime && !updatedMatch.voteLocked) {
      isCorrect = await gameManager.lockMatchVote(matchId);
    }

    return NextResponse.json({
      success: true,
      matchId,
      currentVote: updatedMatch.currentVote,
      voteLocked: updatedMatch.voteLocked,
      voteChanges: updatedMatch.voteHistory.length,
      isCorrect, // Will be null unless vote was just locked
      stakedAmount: updatedMatch.stakedAmount,
      payoutAmount: isCorrect !== null ? (isCorrect ? (BigInt(updatedMatch.stakedAmount || "0") * 2n).toString() : "0") : undefined,
      llmModelId: updatedMatch.opponent.type === "BOT" ? updatedMatch.opponent.llmModelId : undefined,
      llmModelName: updatedMatch.opponent.type === "BOT" ? updatedMatch.opponent.llmModelName : undefined,
    });
  } catch (error) {
    console.error("Error updating vote:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

/**
 * API route to finalize/confirm vote lock when timer expires (idempotent).
 * Vote is automatically locked server-side when endTime passes.
 * This endpoint just refreshes the match state and returns the result.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, fid } = body;

    if (!matchId || !fid) {
      return NextResponse.json(
        { error: "matchId and fid are required." },
        { status: 400 }
      );
    }

    const playerFid = parseInt(fid, 10);
    if (isNaN(playerFid)) {
      return NextResponse.json({ error: "Invalid FID." }, { status: 400 });
    }

    // Verify the match belongs to this player (check Redis if not in memory)
    const match = await gameManager.getMatch(matchId);
    if (!match) {
      console.error(`[/api/match/vote PUT] Match ${matchId} not found for FID ${playerFid}. Match was likely deleted or never existed.`);
      const rawState = await gameManager.getRawState();
      const allMatches = Array.from(rawState.matches.keys());
      console.log(`[/api/match/vote PUT] Currently available matches in memory: ${allMatches.length > 0 ? allMatches.join(', ') : 'NONE'}`);
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    if (match.player.fid !== playerFid) {
      return NextResponse.json(
        { error: "This match does not belong to the specified player." },
        { status: 403 }
      );
    }

    // If vote is already locked, return the result
    if (match.voteLocked) {
      const guess = match.currentVote || "REAL";
      const actualType = match.opponent.type;
      const isCorrect = guess === actualType;

      return NextResponse.json({
        success: true,
        matchId,
        isCorrect,
        actualType,
        finalVote: guess,
        voteLocked: true,
        stakedAmount: match.stakedAmount,
        payoutAmount: isCorrect ? (match.stakedAmount ? (BigInt(match.stakedAmount) * 2n).toString() : "0") : "0",
        llmModelId: match.opponent.type === "BOT" ? match.opponent.llmModelId : undefined,
        llmModelName: match.opponent.type === "BOT" ? match.opponent.llmModelName : undefined,
        userLlmGuess: match.userLlmGuess,
      });
    }

    // If vote is not locked yet (shouldn't happen with auto-lock), lock it now
    const isCorrect = await gameManager.lockMatchVote(matchId);
    if (isCorrect === null) {
      return NextResponse.json(
        { error: "Failed to lock vote." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      matchId,
      isCorrect,
      actualType: match.opponent.type,
      finalVote: match.currentVote || "REAL",
      voteLocked: true,
      stakedAmount: match.stakedAmount,
      payoutAmount: isCorrect ? (match.stakedAmount ? (BigInt(match.stakedAmount) * 2n).toString() : "0") : "0",
      llmModelId: match.opponent.type === "BOT" ? match.opponent.llmModelId : undefined,
      llmModelName: match.opponent.type === "BOT" ? match.opponent.llmModelName : undefined,
      userLlmGuess: match.userLlmGuess,
    });
  } catch (error) {
    console.error("Error finalizing vote:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
