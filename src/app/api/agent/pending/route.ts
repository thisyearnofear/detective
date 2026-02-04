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
  // 1. Authenticate Request
  const auth = await validateAgentRequest(request);
  if (!auth.authorized) {
    return unauthorizedResponse();
  }

  // 2. Rate Limiting: 60 requests per minute per IP
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
    // 3. Authorization: If polling for a specific FID, ensure signer is the controller
    // (We'll check this again inside the filter loop for safety)

    // Use optimized method in GameManager
    const pendingMatches = await gameManager.getPendingExternalBotMatches(targetFid);

    // 4. Filter by Signer: Only return matches for bots the signer controls
    // If auth.address is present, we filter by controllerAddress.
    // If using legacy secret, we return everything (backwards compat).
    const filteredMatches = pendingMatches.filter(m => {
      const bot = m.opponent as any;
      
      // If bot has an owner, and we have a signer, they must match
      if (bot.controllerAddress && auth.address) {
        return bot.controllerAddress.toLowerCase() === auth.address.toLowerCase();
      }
      
      // If bot has an owner but we used legacy secret, hide it (upgrade required)
      if (bot.controllerAddress && !auth.address) {
        return false;
      }

      // If bot has no owner, legacy secret can see it
      return true;
    });

    // Format for the agent
    const response = filteredMatches.map(m => {
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
