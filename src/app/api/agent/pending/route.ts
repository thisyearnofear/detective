import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { guardAgentEndpoint } from "@/lib/agentAuth";

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/pending
 * 
 * Returns a list of active matches where it is an external bot's turn to reply.
 * Optional query param: ?fid=<bot_fid> to filter for a specific bot.
 * 
 * x402: Requires USDC payment when NEXT_PUBLIC_X402_ENABLED=true
 */
export async function GET(request: NextRequest) {
  // Unified guard: auth + rate limit + x402 payment
  const guard = await guardAgentEndpoint(request, {
    rateKey: "pending",
    rateLimit: 60,
    rateWindow: 60,
    priceKey: "pending", // x402 pricing from GAME_CONSTANTS
  });
  
  if (!guard.ok) return guard.response;
  const { auth } = guard;

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
