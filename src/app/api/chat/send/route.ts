// src/app/api/chat/send/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse, getBotResponseTiming } from "@/lib/inference";
import { scheduleBotResponse } from "@/lib/botScheduler";
import { Bot } from "@/lib/types";

/**
 * API route to send a message in a match.
 * Expects a POST request with `matchId`, `senderFid`, and `text`.
 *
 * Bot responses are scheduled with timestamps and delivered during polling.
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

    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    // Add the user's message to the state
    const message = await gameManager.addMessageToMatch(matchId, text, senderFid);

    if (!message) {
      return NextResponse.json(
        { error: "Failed to send message." },
        { status: 500 },
      );
    }

    // If the opponent is a bot, schedule a response
    if (match.opponent.type === "BOT") {
      const bot = match.opponent as Bot;

      // Generate and schedule response asynchronously (don't block the response)
      (async () => {
        try {
          console.log(`[chat/send] User FID ${senderFid} sent message to match ${matchId}, opponent is bot FID ${bot.fid}`);
          
          const botResponse = await generateBotResponse(bot, match.messages);
          console.log(`[chat/send] Generated bot response: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);

          // Calculate realistic timing
          const timing = getBotResponseTiming(bot, match.messages, botResponse.length);
          const totalDelay = timing.initialDelay + timing.typingDuration;
          console.log(`[chat/send] Calculated timing - initialDelay: ${timing.initialDelay}ms, typingDuration: ${timing.typingDuration}ms, totalDelay: ${totalDelay}ms`);

          // Schedule the response in Redis with automatic retry on failure
          await scheduleBotResponse(matchId, bot.fid, botResponse, totalDelay);
          console.log(`[chat/send] ✓ Bot response scheduled successfully`);
        } catch (err) {
          console.error(`[chat/send] ✗ FAILED to schedule bot response for match ${matchId}:`, err);
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
