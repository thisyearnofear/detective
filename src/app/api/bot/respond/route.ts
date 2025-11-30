// src/app/api/bot/respond/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse, getBotResponseTiming } from "@/lib/inference";
import { Bot } from "@/lib/types";

// In-memory storage for scheduled bot responses
const scheduledResponses = new Map<string, NodeJS.Timeout>();

/**
 * API route to schedule bot responses with realistic timing.
 * Called after a human sends a message to a bot opponent.
 */
export async function POST(request: Request) {
  try {
    const { matchId } = await request.json();

    if (!matchId) {
      return NextResponse.json(
        { error: "matchId is required." },
        { status: 400 }
      );
    }

    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    // Check if opponent is a bot
    if (match.opponent.type !== "BOT") {
      return NextResponse.json(
        { error: "Opponent is not a bot." },
        { status: 400 }
      );
    }

    const bot = match.opponent as Bot;

    // Clear any existing scheduled response for this match
    const existingTimeout = scheduledResponses.get(matchId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Generate the response immediately but don't send it yet
    const botResponse = await generateBotResponse(bot, match.messages, matchId);

    // Calculate realistic timing
    const timing = getBotResponseTiming(bot, match.messages, botResponse.length);

    // Schedule the response
    const timeout = setTimeout(async () => {
      // Add the bot's message to the match
      gameManager.addMessageToMatch(matchId, botResponse, bot.fid);

      // Clean up
      scheduledResponses.delete(matchId);

      // Sometimes schedule a follow-up message (10% chance)
      if (Math.random() < 0.1 && match.endTime > Date.now() + 10000) {
        setTimeout(async () => {
          // Generate a short follow-up
          const followUp = await generateBotResponse(bot, match.messages, matchId);
          if (followUp && followUp.length < 50) {
            gameManager.addMessageToMatch(matchId, followUp, bot.fid);
          }
        }, 2000 + Math.random() * 3000); // 2-5 seconds later
      }
    }, timing.initialDelay + timing.typingDuration);

    scheduledResponses.set(matchId, timeout);

    return NextResponse.json({
      success: true,
      scheduledIn: timing.initialDelay,
      typingDuration: timing.typingDuration,
      totalDelay: timing.initialDelay + timing.typingDuration,
    });
  } catch (error) {
    console.error("Error scheduling bot response:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

/**
 * Cancel a scheduled bot response (e.g., if match ends)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json(
        { error: "matchId is required." },
        { status: 400 }
      );
    }

    const timeout = scheduledResponses.get(matchId);
    if (timeout) {
      clearTimeout(timeout);
      scheduledResponses.delete(matchId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling bot response:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
