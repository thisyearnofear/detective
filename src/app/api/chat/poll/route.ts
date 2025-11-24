// src/app/api/chat/poll/route.ts
import { NextResponse, NextRequest } from "next/server";
import { gameManager } from "@/lib/gameState";

/**
 * API route to poll for new messages in a match.
 * Expects a GET request with `matchId` and an optional `since` timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");
    const since = searchParams.get("since");

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required." }, { status: 400 });
    }

    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    if (isNaN(sinceTimestamp)) {
      return NextResponse.json({ error: "Invalid 'since' timestamp." }, { status: 400 });
    }

    const match = gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    // Filter messages that are newer than the 'since' timestamp
    const newMessages = match.messages.filter(
      (msg) => msg.timestamp > sinceTimestamp
    );

    return NextResponse.json({ messages: newMessages });
  } catch (error) {
    console.error("Error polling messages:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}