import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { handleNegotiationAction, generateBotNegotiationAction } from "@/lib/negotiation";
import { isNegotiationMatch } from "@/lib/gameMode";
import type { NegotiationAction, ResourcePool } from "@/lib/types";

export const dynamic = 'force-dynamic';

/**
 * POST /api/negotiation/action
 * 
 * Handle negotiation actions (propose, accept, reject)
 * 
 * PRINCIPLE: ENHANCEMENT - Reuses existing auth/validation patterns
 * PRINCIPLE: CLEAN - Separate from conversation endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, action, message, proposal } = body as {
      matchId: string;
      action: NegotiationAction;
      message: string;
      proposal?: { myShare: ResourcePool; theirShare: ResourcePool };
    };

    // Validate required fields
    if (!matchId || !action || !message) {
      return NextResponse.json(
        { error: "matchId, action, and message are required" },
        { status: 400 }
      );
    }

    // Get match
    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    // Verify it's a negotiation match
    if (!isNegotiationMatch(match)) {
      return NextResponse.json(
        { error: "Not a negotiation match" },
        { status: 400 }
      );
    }

    // Verify match is active
    if (match.isFinished) {
      return NextResponse.json(
        { error: "Match already finished" },
        { status: 400 }
      );
    }

    // TODO: Get player FID from auth (for now, use player from match)
    const playerFid = match.player.fid;

    // Handle player action
    const result = handleNegotiationAction(
      match,
      action,
      playerFid,
      message,
      proposal
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Save updated match
    await gameManager.saveMatch(result.match);

    // If match is finished, return outcome
    if (result.match.isFinished) {
      return NextResponse.json({
        success: true,
        match: result.match,
        outcome: result.match.outcome,
      });
    }

    // Generate bot response if opponent is a bot
    if (result.match.opponent.type === "BOT") {
      const botAction = await generateBotNegotiationAction(result.match);
      
      const botResult = handleNegotiationAction(
        result.match,
        botAction.action,
        result.match.opponent.fid,
        botAction.message,
        botAction.proposal
      );

      if (botResult.success) {
        await gameManager.saveMatch(botResult.match);
        
        return NextResponse.json({
          success: true,
          match: botResult.match,
          botAction,
          outcome: botResult.match.outcome,
        });
      }
    }

    return NextResponse.json({
      success: true,
      match: result.match,
    });

  } catch (error) {
    console.error("[api/negotiation/action] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
