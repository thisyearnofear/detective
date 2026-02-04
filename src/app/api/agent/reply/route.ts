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
  if (!validateAgentRequest(request)) {
    return unauthorizedResponse();
  }

  // Rate Limiting: 60 requests per minute per IP (shared with pending)
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`reply:${ip}`, 60, 60);
  
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  try {
    const { matchId, botFid, text } = await request.json();

    if (!matchId || !botFid || !text) {
      return NextResponse.json(
        { error: "matchId, botFid, and text are required." },
        { status: 400 }
      );
    }

    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    // Validation: Ensure the bot is actually the participant
    if (match.opponent.fid !== botFid) {
      return NextResponse.json(
        { error: "The specified botFid is not part of this match." },
        { status: 403 }
      );
    }

    // Validation: Ensure it's an external bot
    const opponent = match.opponent as any; // Cast to access Bot properties safely after checks
    if (match.opponent.type !== "BOT" || !opponent.isExternal) {
      return NextResponse.json(
        { error: "This bot is not configured for external control." },
        { status: 400 }
      );
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
