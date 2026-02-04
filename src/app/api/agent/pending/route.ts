import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { validateAgentRequest, unauthorizedResponse, checkRateLimit } from "@/lib/agentAuth";

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/pending
 * 
 * Returns a list of active matches where it is an external bot's turn to reply.
 * Optional query param: ?fid=<bot_fid> to filter for a specific bot.
 */
export async function GET(request: NextRequest) {
  if (!validateAgentRequest(request)) {
    return unauthorizedResponse();
  }

  // Rate Limiting: 60 requests per minute per IP
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(`pending:${ip}`, 60, 60);
  
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const targetFid = searchParams.get("fid") ? parseInt(searchParams.get("fid")!, 10) : null;

  try {
    // Use optimized method in GameManager
    const pendingMatches = await gameManager.getPendingExternalBotMatches(targetFid);

    // Format for the agent
    const response = pendingMatches.map(m => {
      // We filtered inside GameManager, so we know opponent is a Bot
      const bot = m.opponent as any; // Type assertion for Bot properties
      
      return {
        matchId: m.id,
        botFid: bot.fid,
        opponentUsername: m.player.username,
        history: m.messages,
        context: {
          round: m.roundNumber,
          botPersonality: bot.personality,
          botStyle: bot.style
        }
      };
    });

    return NextResponse.json({
      success: true,
      count: response.length,
      matches: response
    });

  } catch (error) {
    console.error("[api/agent/pending] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
