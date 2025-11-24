// src/app/api/vote/submit/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to submit a vote for a match.
 * Expects `voterFid`, `matchId`, and `guess` ('REAL' or 'BOT').
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { voterFid, matchId, guess } = body;

    if (!voterFid || !matchId || !guess) {
      return NextResponse.json(
        { error: "voterFid, matchId, and guess are required." },
        { status: 400 }
      );
    }

    if (guess !== "REAL" && guess !== "BOT") {
      return NextResponse.json({ error: "Invalid guess." }, { status: 400 });
    }

    const isCorrect = gameManager.recordVote(voterFid, matchId, guess);

    if (isCorrect === null) {
      return NextResponse.json(
        { error: "Failed to record vote. Match may not exist or vote is already complete." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, correct: isCorrect });
  } catch (error) {
    console.error("Error submitting vote:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}