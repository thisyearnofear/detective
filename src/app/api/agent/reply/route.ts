import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { validateAgentRequest, unauthorizedResponse, checkRateLimit } from "@/lib/agentAuth";

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/reply
 * 
 * Allows an external agent to post a reply to a match.
 * Body: { matchId: string, botFid: number, text: string }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { matchId, botFid, text } = body;

  // Validation: Required fields
  if (!matchId || !botFid || !text) {
    return NextResponse.json(
      { error: "matchId, botFid, and text are required." },
      { status: 400 }
    );
  }

  // 1. Authenticate Request (Supports Signature or Legacy Secret)
  const auth = await validateAgentRequest(request, body);
  if (!auth.authorized) {
    return unauthorizedResponse();
  }

  // 2. Rate Limiting: 60 requests per minute per IP
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`reply:${ip}`, 60, 60);
  
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  try {
    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    // 3. Authorization: Ensure the bot is actually the participant
    const opponent = match.opponent as any; // Cast to Bot
    if (opponent.fid !== botFid) {
      return NextResponse.json(
        { error: "The specified botFid is not part of this match." },
        { status: 403 }
      );
    }

    // 4. Mode Check: Ensure it's an external bot
    if (opponent.type !== "BOT" || !opponent.isExternal) {
      return NextResponse.json(
        { error: "This bot is not configured for external control." },
        { status: 400 }
      );
    }

    // 5. Crypto Verification: If bot has a controllerAddress, enforce signature match
    if (opponent.controllerAddress && auth.address) {
      if (opponent.controllerAddress.toLowerCase() !== auth.address.toLowerCase()) {
        return unauthorizedResponse("Signature address does not match Bot controller address.");
      }
    } else if (opponent.controllerAddress && !auth.address) {
      // Bot has an owner, but agent used legacy secret or didn't provide address
      return unauthorizedResponse("Bot requires cryptographic signature for control.");
    }

    // 6. Turn Validation: Ensure it is the bot's turn
    if (match.messages.length > 0) {
      const lastMessage = match.messages[match.messages.length - 1];
      if (lastMessage.sender.fid === botFid) {
        return NextResponse.json({ error: "It is not your turn to speak." }, { status: 403 });
      }
    }

    // Post the message
    const message = await gameManager.addMessageToMatch(matchId, text, botFid);

    if (!message) {
      return NextResponse.json(
        { error: "Failed to post message." },
        { status: 500 }
      );
    }

    // Optional: We could simulate typing indicators here if the Agent API supported
    // a "start_typing" endpoint, but for now we just post immediately.

    return NextResponse.json({ success: true, message });

  } catch (error) {
    console.error("[api/agent/reply] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
