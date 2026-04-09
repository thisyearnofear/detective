/**
 * Negotiation Game Logic
 * 
 * PRINCIPLE: MODULAR - Self-contained negotiation logic
 * PRINCIPLE: CLEAN - No dependencies on conversation logic
 * PRINCIPLE: DRY - Reuses existing infrastructure (Match, Player, Bot)
 */

import type {
  NegotiationMatch,
  NegotiationRound,
  NegotiationProposal,
  NegotiationAction,
  ResourcePool,
  Player,
  Bot,
} from "./types";
import {
  generateResourcePool,
  generateValuation,
  calculateMaxScore,
  calculateNegotiationScore,
  validateProposal,
} from "./gameMode";

// ============================================================================
// Match Creation
// ============================================================================

/**
 * Create a new negotiation match
 * ENHANCEMENT: Extends existing Match creation pattern
 */
export function createNegotiationMatch(
  matchId: string,
  player: Player,
  opponent: Player | Bot,
  slotNumber: 1 | 2,
  roundNumber: number,
  startTime: number,
  endTime: number
): NegotiationMatch {
  const resourcePool = generateResourcePool();
  const playerValuation = generateValuation();
  const opponentValuation = generateValuation();

  return {
    id: matchId,
    mode: 'negotiation',
    player,
    opponent,
    startTime,
    endTime,
    messages: [], // Keep for compatibility, but unused in negotiation
    isVotingComplete: false,
    isFinished: false,
    slotNumber,
    roundNumber,
    voteHistory: [], // Keep for compatibility
    voteLocked: false,
    lastPlayerMessageTime: startTime,
    resourcePool,
    playerValuation,
    opponentValuation,
    rounds: [],
  };
}

// ============================================================================
// Action Handling
// ============================================================================

/**
 * Handle a negotiation action (propose, accept, reject)
 * CLEAN: Single function handles all action types
 */
export function handleNegotiationAction(
  match: NegotiationMatch,
  action: NegotiationAction,
  actorFid: number,
  message: string,
  proposal?: { myShare: ResourcePool; theirShare: ResourcePool }
): { success: boolean; error?: string; match: NegotiationMatch } {
  const now = Date.now();

  // Validate action
  if (action === 'accept' && !match.currentProposal) {
    return { success: false, error: "No proposal to accept", match };
  }

  if (action === 'propose' && !proposal) {
    return { success: false, error: "Proposal required for propose action", match };
  }

  // Validate proposal if provided
  if (proposal) {
    const validation = validateProposal(proposal.myShare, proposal.theirShare, match.resourcePool);
    if (!validation.valid) {
      return { success: false, error: validation.error, match };
    }
  }

  // Create round record
  const round: NegotiationRound = {
    roundNumber: match.rounds.length + 1,
    action,
    message,
    timestamp: now,
    actor: actorFid,
  };

  // Handle proposal
  if (action === 'propose' && proposal) {
    const proposalRecord: NegotiationProposal = {
      id: `proposal-${match.id}-${round.roundNumber}`,
      proposer: actorFid,
      myShare: proposal.myShare,
      theirShare: proposal.theirShare,
      message,
      timestamp: now,
    };
    
    round.proposal = proposalRecord;
    match.currentProposal = proposalRecord;
  }

  // Handle accept
  if (action === 'accept' && match.currentProposal) {
    match.isFinished = true;
    match.voteLocked = true;
    match.isVotingComplete = true;

    // Calculate scores
    const playerMaxScore = calculateMaxScore(match.resourcePool, match.playerValuation);
    const opponentMaxScore = calculateMaxScore(match.resourcePool, match.opponentValuation);

    // Determine who gets which share
    const isPlayerProposer = match.currentProposal.proposer === match.player.fid;
    const playerShare = isPlayerProposer 
      ? match.currentProposal.myShare 
      : match.currentProposal.theirShare;
    const opponentShare = isPlayerProposer 
      ? match.currentProposal.theirShare 
      : match.currentProposal.myShare;

    const playerScore = calculateNegotiationScore(playerShare, match.playerValuation, playerMaxScore);
    const opponentScore = calculateNegotiationScore(opponentShare, match.opponentValuation, opponentMaxScore);

    match.outcome = {
      dealReached: true,
      finalProposal: match.currentProposal,
      playerScore,
      opponentScore,
      rounds: match.rounds.length + 1,
    };
  }

  // Add round to history
  match.rounds.push(round);

  return { success: true, match };
}

// ============================================================================
// Match Completion
// ============================================================================

/**
 * Handle match timeout (no deal reached)
 * CLEAN: Separate from action handling
 */
export function handleNegotiationTimeout(match: NegotiationMatch): NegotiationMatch {
  if (match.isFinished) return match;

  match.isFinished = true;
  match.voteLocked = true;
  match.isVotingComplete = true;

  match.outcome = {
    dealReached: false,
    playerScore: -0.5,
    opponentScore: -0.5,
    rounds: match.rounds.length,
  };

  return match;
}

// ============================================================================
// Bot Strategy
// ============================================================================

/**
 * Generate bot negotiation action using LLM
 * MODULAR: Can be replaced with different strategies
 */
export async function generateBotNegotiationAction(
  match: NegotiationMatch,
  _strategyPrompt?: string
): Promise<{ action: NegotiationAction; message: string; proposal?: { myShare: ResourcePool; theirShare: ResourcePool } }> {
  // Use LLM for strategic negotiation
  try {
    const { generateWithAssignedLLM } = await import("./openrouter");
    
    // Build context for LLM
    const context = buildNegotiationContext(match);
    const systemPrompt = buildNegotiationSystemPrompt(match);
    
    // Get LLM response
    const result = await generateWithAssignedLLM(
      match.opponent as any, // Bot
      context,
      systemPrompt,
      300 // max tokens
    );

    if (result.error) {
      console.warn("[generateBotNegotiationAction] LLM error, falling back to heuristic:", result.error);
      return generateHeuristicAction(match);
    }

    // Parse LLM response
    const parsed = parseNegotiationResponse(result.content, match);
    if (parsed) {
      return parsed;
    }

    // Fallback to heuristic if parsing fails
    console.warn("[generateBotNegotiationAction] Failed to parse LLM response, using heuristic");
    return generateHeuristicAction(match);
    
  } catch (error) {
    console.error("[generateBotNegotiationAction] Error:", error);
    return generateHeuristicAction(match);
  }
}

/**
 * Build context string for LLM
 */
function buildNegotiationContext(match: NegotiationMatch): string {
  const { resourcePool, opponentValuation, rounds, currentProposal } = match;
  
  let context = `You are negotiating a resource split. Here's the situation:\n\n`;
  context += `Resources available:\n`;
  context += `- Books: ${resourcePool.books} (you value each at ${opponentValuation.books} points)\n`;
  context += `- Hats: ${resourcePool.hats} (you value each at ${opponentValuation.hats} points)\n`;
  context += `- Balls: ${resourcePool.balls} (you value each at ${opponentValuation.balls} points)\n\n`;
  
  context += `Round ${rounds.length + 1} of 5. `;
  
  if (currentProposal) {
    const isYourProposal = currentProposal.proposer === match.opponent.fid;
    if (isYourProposal) {
      context += `Your last proposal is on the table.\n`;
    } else {
      context += `Their proposal:\n`;
      context += `- They get: ${currentProposal.myShare.books} books, ${currentProposal.myShare.hats} hats, ${currentProposal.myShare.balls} balls\n`;
      context += `- You get: ${currentProposal.theirShare.books} books, ${currentProposal.theirShare.hats} hats, ${currentProposal.theirShare.balls} balls\n`;
      context += `Message: "${currentProposal.message}"\n`;
    }
  }
  
  if (rounds.length > 0) {
    context += `\nNegotiation history:\n`;
    rounds.slice(-3).forEach((round) => {
      const actor = round.actor === match.opponent.fid ? "You" : "They";
      context += `- ${actor} ${round.action}: "${round.message}"\n`;
    });
  }
  
  return context;
}

/**
 * Build system prompt for negotiation
 */
function buildNegotiationSystemPrompt(_match: NegotiationMatch): string {
  return `You are a skilled negotiator. Your goal is to maximize your score by getting resources you value highly.

Key strategies:
- ANCHORING: Make the first offer to set expectations
- FRAMING: Present offers as fair and beneficial
- RECIPROCITY: Match concessions to build trust
- LOSS AVERSION: Emphasize what they'd lose with no deal (-50% penalty)
- URGENCY: Use time pressure (5 rounds only)

Your valuations are HIDDEN from them. They have different valuations.

Respond in this EXACT format:
ACTION: [propose/accept/reject]
MESSAGE: [your message to them]
PROPOSAL: [only if proposing] books=X,hats=Y,balls=Z for you | books=A,hats=B,balls=C for them

Example responses:
ACTION: propose
MESSAGE: I think this split is fair for both of us
PROPOSAL: books=2,hats=1,balls=2 for you | books=1,hats=2,balls=1 for them

ACTION: accept
MESSAGE: That works for me, let's make a deal

ACTION: reject
MESSAGE: I need more books to make this worthwhile

Be conversational and strategic. Keep messages under 100 characters.`;
}

/**
 * Parse LLM response into action
 */
function parseNegotiationResponse(
  text: string,
  match: NegotiationMatch
): { action: NegotiationAction; message: string; proposal?: { myShare: ResourcePool; theirShare: ResourcePool } } | null {
  try {
    // Extract action
    const actionMatch = text.match(/ACTION:\s*(propose|accept|reject)/i);
    if (!actionMatch) return null;
    const action = actionMatch[1].toLowerCase() as NegotiationAction;

    // Extract message
    const messageMatch = text.match(/MESSAGE:\s*(.+?)(?:\n|$)/i);
    if (!messageMatch) return null;
    const message = messageMatch[1].trim();

    // Extract proposal if proposing
    if (action === 'propose') {
      const proposalMatch = text.match(/PROPOSAL:\s*books=(\d+),hats=(\d+),balls=(\d+)\s+for you\s*\|\s*books=(\d+),hats=(\d+),balls=(\d+)\s+for them/i);
      if (!proposalMatch) return null;

      const myShare: ResourcePool = {
        books: parseInt(proposalMatch[1]),
        hats: parseInt(proposalMatch[2]),
        balls: parseInt(proposalMatch[3]),
      };

      const theirShare: ResourcePool = {
        books: parseInt(proposalMatch[4]),
        hats: parseInt(proposalMatch[5]),
        balls: parseInt(proposalMatch[6]),
      };

      // Validate proposal
      const validation = validateProposal(myShare, theirShare, match.resourcePool);
      if (!validation.valid) {
        console.warn("[parseNegotiationResponse] Invalid proposal from LLM:", validation.error);
        return null;
      }

      return { action, message, proposal: { myShare, theirShare } };
    }

    return { action, message };
  } catch (error) {
    console.error("[parseNegotiationResponse] Parse error:", error);
    return null;
  }
}

/**
 * Fallback heuristic strategy (original simple logic)
 */
function generateHeuristicAction(match: NegotiationMatch): { action: NegotiationAction; message: string; proposal?: { myShare: ResourcePool; theirShare: ResourcePool } } {
  const roundNumber = match.rounds.length + 1;
  const hasProposal = !!match.currentProposal;

  // Simple strategy: propose on odd rounds, respond on even rounds
  if (roundNumber === 1 || (!hasProposal && roundNumber % 2 === 1)) {
    // Make a proposal favoring high-value items
    const proposal = generateBotProposal(match);
    return {
      action: 'propose',
      message: "Here's my proposal for a fair split",
      proposal,
    };
  }

  if (hasProposal) {
    // Evaluate current proposal
    const score = evaluateProposalForBot(match, match.currentProposal!);
    
    // Accept if score > 0.4, or if it's the final round
    if (score > 0.4 || roundNumber >= 5) {
      return {
        action: 'accept',
        message: "I accept this deal",
      };
    }

    // Otherwise, counter-propose
    const proposal = generateBotProposal(match);
    return {
      action: 'propose',
      message: "Let me counter with this",
      proposal,
    };
  }

  // Default: reject and wait
  return {
    action: 'reject',
    message: "Let's keep negotiating",
  };
}

/**
 * Generate a bot proposal based on valuations
 * PRIVATE: Implementation detail
 */
function generateBotProposal(match: NegotiationMatch): { myShare: ResourcePool; theirShare: ResourcePool } {
  // Simple strategy: take items you value most
  const { resourcePool, opponentValuation } = match;
  
  // Sort items by bot's valuation
  const items = [
    { name: 'books', value: opponentValuation.books, total: resourcePool.books },
    { name: 'hats', value: opponentValuation.hats, total: resourcePool.hats },
    { name: 'balls', value: opponentValuation.balls, total: resourcePool.balls },
  ].sort((a, b) => b.value - a.value);

  const myShare: ResourcePool = { books: 0, hats: 0, balls: 0 };
  const theirShare: ResourcePool = { books: 0, hats: 0, balls: 0 };

  // Take more of high-value items, give more of low-value items
  items.forEach((item, index) => {
    const key = item.name as keyof ResourcePool;
    if (index === 0) {
      // Highest value: take 60-70%
      myShare[key] = Math.ceil(item.total * 0.65);
      theirShare[key] = item.total - myShare[key];
    } else if (index === 1) {
      // Medium value: split evenly
      myShare[key] = Math.floor(item.total / 2);
      theirShare[key] = item.total - myShare[key];
    } else {
      // Lowest value: give 60-70%
      theirShare[key] = Math.ceil(item.total * 0.65);
      myShare[key] = item.total - theirShare[key];
    }
  });

  return { myShare, theirShare };
}

/**
 * Evaluate a proposal from the bot's perspective
 * PRIVATE: Implementation detail
 */
function evaluateProposalForBot(match: NegotiationMatch, proposal: NegotiationProposal): number {
  const { resourcePool, opponentValuation } = match;
  const maxScore = calculateMaxScore(resourcePool, opponentValuation);
  
  // Determine bot's share
  const isBotProposer = proposal.proposer === match.opponent.fid;
  const botShare = isBotProposer ? proposal.myShare : proposal.theirShare;
  
  return calculateNegotiationScore(botShare, opponentValuation, maxScore);
}
