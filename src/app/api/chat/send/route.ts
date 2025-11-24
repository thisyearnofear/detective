// src/app/api/chat/send/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse, getBotResponseTiming } from "@/lib/inference";
import { Bot } from "@/lib/types";

/**
 * API route to send a message in a match.
 * Expects a POST request with `matchId`, `senderFid`, and `text`.
 */
export async function POST(request: Request) {
  try {
    const { matchId, senderFid, text } = await request.json();

    if (!matchId || !senderFid || !text) {
      return NextResponse.json(
        { error: "matchId, senderFid, and text are required." },
        { status: 400 },
      );
    }

    const match = gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    // Add the user's message to the state
    const message = gameManager.addMessageToMatch(matchId, text, senderFid);

    if (!message) {
      return NextResponse.json(
        { error: "Failed to send message." },
        { status: 500 },
      );
    }

    // If the opponent is a bot, trigger a delayed response
    if (match.opponent.type === "BOT") {
      // Call the bot respond endpoint to schedule the response
      // We do this asynchronously and don't wait for it
      fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/bot/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        },
      ).catch((err) => {
        console.error("Failed to schedule bot response:", err);
      });
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
