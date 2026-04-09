/**
 * Game Mode Utilities - Single Source of Truth
 * 
 * PRINCIPLE: DRY - All mode-specific logic centralized here
 * PRINCIPLE: MODULAR - Each mode is self-contained
 * PRINCIPLE: CLEAN - Clear separation of concerns
 */

import type { GameMode, Match, NegotiationMatch, ResourcePool, ResourceValuation } from "./types";

// ============================================================================
// Mode Detection (Type Guards)
// ============================================================================

export function isNegotiationMatch(match: Match): match is NegotiationMatch {
  return match.mode === 'negotiation';
}

export function isConversationMatch(match: Match): boolean {
  return !match.mode || match.mode === 'conversation';
}

// ============================================================================
// Mode Configuration
// ============================================================================

export const MODE_CONFIG = {
  conversation: {
    name: "Conversation",
    description: "Detect AI in natural conversation",
    icon: "💬",
    rounds: 5,
    roundDuration: 60000, // 1 minute
    scoring: "detection", // Accuracy-based
  },
  negotiation: {
    name: "Negotiation",
    description: "Outsmart AI in resource deals",
    icon: "🤝",
    rounds: 5,
    roundDuration: 60000, // 1 minute per round
    scoring: "value", // Value-based (0.0 to 1.0)
  },
} as const;

// ============================================================================
// Resource Generation (Negotiation Mode)
// ============================================================================

/**
 * Generate random resource pool for negotiation
 * Ensures interesting trade-offs (not all equal)
 */
export function generateResourcePool(): ResourcePool {
  return {
    books: Math.floor(Math.random() * 3) + 2, // 2-4
    hats: Math.floor(Math.random() * 3) + 2,  // 2-4
    balls: Math.floor(Math.random() * 3) + 2, // 2-4
  };
}

/**
 * Generate random valuations for a player
 * Ensures diversity (not all items valued equally)
 */
export function generateValuation(): ResourceValuation {
  const values = [2, 4, 6, 8, 10]; // Possible values
  const shuffled = values.sort(() => Math.random() - 0.5);
  
  return {
    books: shuffled[0],
    hats: shuffled[1],
    balls: shuffled[2],
  };
}

/**
 * Calculate maximum possible score for a player
 */
export function calculateMaxScore(pool: ResourcePool, valuation: ResourceValuation): number {
  return (
    pool.books * valuation.books +
    pool.hats * valuation.hats +
    pool.balls * valuation.balls
  );
}

/**
 * Calculate actual score from a resource split
 * Returns normalized score (0.0 to 1.0)
 */
export function calculateNegotiationScore(
  share: ResourcePool,
  valuation: ResourceValuation,
  maxScore: number
): number {
  const actualScore = (
    share.books * valuation.books +
    share.hats * valuation.hats +
    share.balls * valuation.balls
  );
  
  return actualScore / maxScore;
}

/**
 * Validate that a proposal splits resources correctly
 */
export function validateProposal(
  myShare: ResourcePool,
  theirShare: ResourcePool,
  pool: ResourcePool
): { valid: boolean; error?: string } {
  if (myShare.books + theirShare.books !== pool.books) {
    return { valid: false, error: "Books don't add up to pool" };
  }
  if (myShare.hats + theirShare.hats !== pool.hats) {
    return { valid: false, error: "Hats don't add up to pool" };
  }
  if (myShare.balls + theirShare.balls !== pool.balls) {
    return { valid: false, error: "Balls don't add up to pool" };
  }
  
  return { valid: true };
}

// ============================================================================
// Mode-Specific Scoring
// ============================================================================

/**
 * Calculate score for any match type
 * Single source of truth for scoring logic
 */
export function calculateMatchScore(match: Match): number {
  if (isNegotiationMatch(match)) {
    return match.outcome?.playerScore ?? -0.5;
  }
  
  // Conversation mode: accuracy-based
  const correctVotes = match.player.voteHistory.filter(v => v.correct && !v.forfeit).length;
  const totalVotes = match.player.voteHistory.length;
  return totalVotes > 0 ? correctVotes / totalVotes : 0;
}

// ============================================================================
// Mode-Specific Display
// ============================================================================

export function getModeName(mode: GameMode): string {
  return MODE_CONFIG[mode].name;
}

export function getModeDescription(mode: GameMode): string {
  return MODE_CONFIG[mode].description;
}

export function getModeIcon(mode: GameMode): string {
  return MODE_CONFIG[mode].icon;
}

// ============================================================================
// Mode-Specific Validation
// ============================================================================

/**
 * Check if a match is valid for its mode
 */
export function validateMatch(match: Match): { valid: boolean; error?: string } {
  if (isNegotiationMatch(match)) {
    // Negotiation-specific validation
    if (!match.resourcePool) {
      return { valid: false, error: "Missing resource pool" };
    }
    if (!match.playerValuation || !match.opponentValuation) {
      return { valid: false, error: "Missing valuations" };
    }
    return { valid: true };
  }
  
  // Conversation mode validation
  if (!match.messages) {
    return { valid: false, error: "Missing messages" };
  }
  
  return { valid: true };
}
