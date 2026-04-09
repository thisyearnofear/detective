/**
 * MPP-Enabled Agent Negotiation Endpoint
 * 
 * Allows external AI agents to pay and play negotiation matches using MPP
 * Perfect for Optimization Arena hackathon participants with $20 Tempo credit
 * 
 * Usage with mppx CLI:
 * ```bash
 * npx mppx https://detective.com/api/agent/negotiate --method POST \
 *   -J '{"agentId":"agent-123","action":"start"}'
 * ```
 * 
 * The mppx CLI automatically handles:
 * - 402 Payment Required challenge
 * - Payment credential signing
 * - Request retry with payment
 */

import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { handleNegotiationAction, generateBotNegotiationAction } from "@/lib/negotiation";
import { isNegotiationMatch } from "@/lib/gameMode";
import { requireMPPPayment, getMPPPricing } from "@/lib/mpp";
import type { NegotiationAction } from "@/lib/types";

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/negotiate
 * 
 * Get pricing and setup information
 */
export async function GET() {
  return NextResponse.json(getMPPPricing());
}

/**
 * POST /api/agent/negotiate
 * 
 * MPP-enabled negotiation endpoint
 * 
 * First request (no payment):
 * → 402 Payment Required with challenge
 * 
 * Second request (with payment via mppx):
 * → 200 OK with match details and receipt
 */
export async function POST(request: NextRequest) {
  try {
    // Require MPP payment (handles 402 challenge automatically)
    const payment = await requireMPPPayment(request, 'NEGOTIATION_MATCH');
    
    if (!payment.verified) {
      return payment.response!; // Return 402 challenge
    }

    // Payment verified - proceed with request
    const body = await request.json();
    const { agentId, action, matchId, message, proposal } = body;

    // Validate required fields
    if (!agentId || !action) {
      return NextResponse.json(
        { error: "agentId and action are required" },
        { status: 400 }
      );
    }

    // Handle negotiation action
    if (action === 'start') {
      // Create a new match for the agent
      // TODO: Implement agent match creation
      return NextResponse.json({
        success: true,
        message: "Match creation not yet implemented",
        agentId,
        paymentId: payment.paymentId,
      }, {
        headers: payment.receiptHeaders,
      });
    }

    // Handle existing match actions
    if (!matchId) {
      return NextResponse.json(
        { error: "matchId required for this action" },
        { status: 400 }
      );
    }

    const match = await gameManager.getMatch(matchId);
    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    if (!isNegotiationMatch(match)) {
      return NextResponse.json(
        { error: "Not a negotiation match" },
        { status: 400 }
      );
    }

    // Handle negotiation action
    const result = handleNegotiationAction(
      match,
      action as NegotiationAction,
      match.player.fid,
      message || "",
      proposal
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    await gameManager.saveMatch(result.match);

    // Generate bot response if needed
    let botAction;
    if (result.match.opponent.type === "BOT" && !result.match.isFinished) {
      botAction = await generateBotNegotiationAction(result.match);
      
      const botResult = handleNegotiationAction(
        result.match,
        botAction.action,
        result.match.opponent.fid,
        botAction.message,
        botAction.proposal
      );

      if (botResult.success) {
        await gameManager.saveMatch(botResult.match);
      }
    }

    return NextResponse.json({
      success: true,
      match: result.match,
      botAction,
      outcome: result.match.outcome,
      paymentId: payment.paymentId,
    }, {
      headers: payment.receiptHeaders,
    });

  } catch (error) {
    console.error("[api/agent/negotiate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
