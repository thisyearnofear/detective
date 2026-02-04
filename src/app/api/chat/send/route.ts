// src/app/api/chat/send/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { generateBotResponse } from "@/lib/inference";
import { Bot } from "@/lib/types";
import { getRepository } from "@/lib/gameRepository";
import { calculateTypingDelay } from "@/lib/typingDelay";

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

    // Track typing indicator to return to client
    let typingIndicator = null;

    // If the opponent is a bot, generate and deliver response INLINE
    if (match.opponent.type === "BOT") {
      // Ensure we have fresh bot data (in case another instance registered it)
      // Repository handles caching with TTL + version invalidation
      const freshBots = await getRepository().getBots();
      const bot = freshBots.get(match.opponent.fid) as Bot || match.opponent;

      // EXTERNAL AGENT BYPASS
      if (bot.isExternal) {
        console.log(`[chat/send] External bot ${bot.fid} will reply asynchronously via Agent API`);
        // We return success immediately. The external agent is responsible for polling /api/agent/pending
        return NextResponse.json({ success: true, message, typingIndicator: null });
      }

      console.log(`[chat/send] User FID ${senderFid} sent message to match ${matchId}, opponent is bot FID ${bot.fid}`);

      try {
         // Generate bot response
         const botResponse = await generateBotResponse(bot, match.messages, matchId);
         console.log(`[chat/send] Generated bot response: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);

         // Calculate variable typing delay based on message length, emoji count, and personality
         // Thinking time varies by communication style, typing time by message complexity
         const lastUserMessage = match.messages
           .filter(m => m.sender.fid !== bot.fid)
           .slice(-1)[0]?.text;
         
         const communicationStyle = bot.personality?.communicationStyle || "conversational";
         const typingDelay = calculateTypingDelay(botResponse, communicationStyle, lastUserMessage);
         console.log(`[chat/send] Delaying bot response by ${typingDelay}ms (style: ${communicationStyle}, message: ${botResponse.length} chars)`);

        // Set typing indicator before delay
        const startTime = Date.now();
        const endTime = startTime + typingDelay;
        match.typingIndicator = {
          isTyping: true,
          startTime,
          endTime,
          hasPauses: false,
        };

        // Return typing indicator to client immediately so it can show typing animation
        typingIndicator = {
          isTyping: true,
          startTime,
          endTime,
          duration: typingDelay,
        };

        await new Promise(resolve => setTimeout(resolve, typingDelay));

        // Clear typing indicator and deliver the bot response
        match.typingIndicator = {
          isTyping: false,
          startTime,
          endTime,
          hasPauses: false,
        };
        
        await gameManager.addMessageToMatch(matchId, botResponse, bot.fid);
        console.log(`[chat/send] ✓ Bot response delivered successfully`);
      } catch (err) {
        console.error(`[chat/send] ✗ FAILED to generate/deliver bot response for match ${matchId}:`, err);
        // Clear typing indicator on error
        match.typingIndicator = {
          isTyping: false,
          startTime: Date.now(),
          endTime: Date.now(),
          hasPauses: false,
        };
        // Don't fail the user's message if the bot response fails
      }
    }

    return NextResponse.json({ success: true, message, typingIndicator });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
