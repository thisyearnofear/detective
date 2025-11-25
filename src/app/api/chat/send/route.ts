// src/app/api/chat/send/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse, getBotResponseTiming } from "@/lib/inference";
import { Bot } from "@/lib/types";

// In-memory storage for scheduled bot responses
const scheduledResponses = new Map<string, NodeJS.Timeout>();

/**
 * API route to send a message in a match.
 * Expects a POST request with `matchId`, `senderFid`, and `text`.
 *
 * Bot responses are now handled inline to avoid ECONNREFUSED issues
 * when calling back to the server.
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

    const match = await gameManager.getMatchAsync(matchId);
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

    // If the opponent is a bot, schedule a response inline
    // This avoids the ECONNREFUSED issue from calling back to the server
    if (match.opponent.type === "BOT") {
      const bot = match.opponent as Bot;

      // Clear any existing scheduled response for this match
      const existingTimeout = scheduledResponses.get(matchId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Generate the response asynchronously (don't block the response)
      (async () => {
        try {
          const botResponse = await generateBotResponse(bot, match.messages);

          // Calculate realistic timing
          const timing = getBotResponseTiming(bot, match.messages, botResponse.length);

          // Schedule the response with realistic delay
          const timeout = setTimeout(() => {
            // Verify match still exists and is active
            const currentMatch = gameManager.getMatch(matchId);
            if (currentMatch && currentMatch.endTime > Date.now()) {
              gameManager.addMessageToMatch(matchId, botResponse, bot.fid);
            }
            scheduledResponses.delete(matchId);
          }, timing.initialDelay + timing.typingDuration);

          scheduledResponses.set(matchId, timeout);
        } catch (err) {
          console.error("Failed to generate bot response:", err);
        }
      })();
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
