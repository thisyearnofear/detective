import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { guardAgentEndpoint, unauthorizedResponse } from "@/lib/agentAuth";

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/reply
 * 
 * Allows an external agent to post a reply to a match.
 * Body: { matchId: string, botFid: number, text: string }
 * 
 * x402: Requires USDC payment when NEXT_PUBLIC_X402_ENABLED=true
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

  // Unified guard: auth + rate limit + x402 payment
  const guard = await guardAgentEndpoint(request, {
    rateKey: "reply",
    rateLimit: 60,
    rateWindow: 60,
    priceKey: "reply", // x402 pricing from GAME_CONSTANTS
    payload: body,
  });
  
  if (!guard.ok) return guard.response;
  const { auth } = guard;

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
