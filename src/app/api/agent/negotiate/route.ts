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
import { handleNegotiationAction, generateBotNegotiationAction, createNegotiationMatch } from "@/lib/negotiation";
import { isNegotiationMatch } from "@/lib/gameMode";
import { requireMPPPayment, getMPPPricing } from "@/lib/mpp";
import type { NegotiationAction, NegotiationMatch, Bot } from "@/lib/types";

export const dynamic = 'force-dynamic';

/**
 * Create a match for an external agent
 * ENHANCEMENT: Reuses existing match creation infrastructure
 */
async function createAgentMatch(agentId: string): Promise<NegotiationMatch | null> {
  // Create a temporary player object for the agent
  const agentPlayer = {
    fid: Math.abs(hashString(agentId)), // Generate consistent FID from agentId
    username: agentId,
    displayName: agentId,
    pfpUrl: "",
    type: "REAL" as const,
    isRegistered: true,
    isReady: true,
    score: 0,
    voteHistory: [],
    inactivityStrikes: 0,
    lastActiveTime: Date.now(),
    hasPermission: false,
  };

  // Select a bot opponent
  const bots = await gameManager.getAllBots();
  if (bots.length === 0) {
    console.error("[createAgentMatch] No bots available");
    return null;
  }

  // Pick a random bot
  const opponent = bots[Math.floor(Math.random() * bots.length)] as Bot;

  const now = Date.now();
  const matchId = `agent-match-${agentId}-${now}`;
  const matchDuration = 5 * 60 * 1000; // 5 minutes for agent matches

  // ENHANCEMENT: Reuse createNegotiationMatch from negotiation.ts
  const match = createNegotiationMatch(
    matchId,
    agentPlayer,
    opponent,
    1, // slotNumber
    1, // roundNumber
    now,
    now + matchDuration
  );

  // Save match to game state
  await gameManager.saveMatch(match);

  return match;
}

/**
 * Simple string hash function for generating consistent FIDs
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

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
      const match = await createAgentMatch(agentId);
      
      if (!match) {
        return NextResponse.json(
          { error: "Failed to create match - no available opponents" },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        matchId: match.id,
        agentId,
        opponent: {
          fid: match.opponent.fid,
          username: match.opponent.username,
          type: match.opponent.type,
        },
        resourcePool: match.resourcePool,
        playerValuation: match.playerValuation,
        startTime: match.startTime,
        endTime: match.endTime,
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
