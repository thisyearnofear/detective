import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse } from "@/lib/inference";
import { calculateTypingDelay } from "@/lib/typingDelay";
import type { Bot } from "@/lib/types";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/send
 *
 * Append a player message to a match. If the opponent is a house bot,
 * generate and append a persona-grounded reply.
 *
 * Body: { matchId: string, senderFid: number, text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, senderFid, text } = body;

    if (!matchId || !senderFid || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "matchId, senderFid, and text are required." },
        { status: 400 },
      );
    }

    const fid = typeof senderFid === "number" ? senderFid : parseInt(senderFid, 10);
    if (isNaN(fid)) {
      return NextResponse.json({ error: "Invalid senderFid." }, { status: 400 });
    }

    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    if (match.player.fid !== fid) {
      return NextResponse.json(
        { error: "This match does not belong to the specified player." },
        { status: 403 },
      );
    }

    if (match.voteLocked || match.isFinished) {
      return NextResponse.json(
        { error: "Match is already finished." },
        { status: 403 },
      );
    }

    if (Date.now() >= match.endTime) {
      return NextResponse.json(
        { error: "Match time has expired." },
        { status: 403 },
      );
    }

    const trimmed = text.trim().slice(0, 500);
    const playerMessage = await gameManager.addMessageToMatch(matchId, trimmed, fid);
    if (!playerMessage) {
      return NextResponse.json(
        { error: "Failed to add message." },
        { status: 500 },
      );
    }

    const opponent = match.opponent;
    const response: {
      success: true;
      message: typeof playerMessage;
      botMessage?: Awaited<ReturnType<typeof gameManager.addMessageToMatch>>;
      typingIndicator?: { isTyping: boolean; duration: number };
    } = {
      success: true,
      message: playerMessage,
    };

    // House bots reply immediately; external agents reply via /api/agent/reply
    if (opponent.type === "BOT" && !(opponent as Bot).isExternal) {
      const bot = opponent as Bot;
      const updatedMatch = await gameManager.getMatch(matchId);
      const history = updatedMatch?.messages ?? [...match.messages, playerMessage];

      const botText = await generateBotResponse(bot, history, matchId);
      const style =
        bot.personality?.communicationStyle ||
        ("conversational" as const);
      const duration = calculateTypingDelay(botText, style, trimmed);

      const botMessage = await gameManager.addMessageToMatch(
        matchId,
        botText,
        bot.fid,
      );

      response.botMessage = botMessage;
      response.typingIndicator = {
        isTyping: true,
        duration: Math.min(duration, 8000),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[api/chat/send] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
