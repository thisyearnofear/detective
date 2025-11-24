// src/app/api/chat/send/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse } from "@/lib/inference";
import { Bot } from "@/lib/types";

/**
 * API route to send a message in a match.
 * Expects a POST request with `matchId`, `senderFid`, and `text`.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matchId, senderFid, text } = body;

    if (!matchId || !senderFid || !text) {
      return NextResponse.json(
        { error: "matchId, senderFid, and text are required." },
        { status: 400 }
      );
    }

    const match = gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    if (Date.now() > match.endTime) {
      return NextResponse.json({ error: "Match has ended." }, { status: 403 });
    }

    // Add the player's message to the state
    gameManager.addMessageToMatch(matchId, text, senderFid);

    // If the opponent is a bot, generate a response
    if (match.opponent.type === "BOT") {
      const bot = match.opponent as Bot;
      const botResponse = await generateBotResponse(bot, match.messages);
      // Add the bot's response to the state
      gameManager.addMessageToMatch(matchId, botResponse, bot.fid);
    }

    return NextResponse.json({ success: true, message: "Message sent." });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}