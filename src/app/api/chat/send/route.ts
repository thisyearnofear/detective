// src/app/api/chat/send/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse } from "@/lib/inference";
import { Bot } from "@/lib/types";

/**
 * API route to send a message in a match.
 * Expects a POST request with `matchId`, `senderFid`, and `text`.
 *
 * INLINE BOT RESPONSES: Bot responses are generated and delivered immediately
 * with a natural delay (300-800ms), eliminating scheduler complexity.
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

    // If the opponent is a bot, generate and deliver response INLINE
    if (match.opponent.type === "BOT") {
      const bot = match.opponent as Bot;

      console.log(`[chat/send] User FID ${senderFid} sent message to match ${matchId}, opponent is bot FID ${bot.fid}`);

      try {
        // Generate bot response
        const botResponse = await generateBotResponse(bot, match.messages, matchId);
        console.log(`[chat/send] Generated bot response: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);

        // Add natural delay (300-800ms) to feel more human
        // This replaces the complex Redis scheduling system
        const naturalDelay = 300 + Math.random() * 500; // 300-800ms
        console.log(`[chat/send] Delaying bot response by ${Math.round(naturalDelay)}ms for natural feel`);

        await new Promise(resolve => setTimeout(resolve, naturalDelay));

        // Deliver the bot response immediately
        await gameManager.addMessageToMatch(matchId, botResponse, bot.fid);
        console.log(`[chat/send] ✓ Bot response delivered successfully`);
      } catch (err) {
        console.error(`[chat/send] ✗ FAILED to generate/deliver bot response for match ${matchId}:`, err);
        // Don't fail the user's message if the bot response fails
      }
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
