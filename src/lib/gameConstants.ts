/**
 * Game configuration constants
 * SINGLE SOURCE OF TRUTH for game rules and limits
 * DRY: Shared across backend, frontend, and game state
 */

export const GAME_CONSTANTS = {
  // Player limits
  MIN_PLAYERS: 3, // Minimum to start investigation
  MAX_PLAYERS: 50, // Maximum concurrent players in single match

  // Timing (milliseconds)
  REGISTRATION_COUNTDOWN: 30 * 1000, // 30 seconds after min players join
  MATCH_DURATION: 60 * 1000, // 60 seconds per round
  FIXED_ROUNDS: 5, // Total rounds
  INACTIVITY_WARNING: 30 * 1000, // 30 seconds
  INACTIVITY_FORFEIT: 45 * 1000, // 45 seconds

  // Economic Stakes (Arbitrum Native)
  MATCH_STAKE_WEI: "1000000000000000", // 0.001 ARB/ETH per match
} as const;

// Computed values
export const GAME_DURATION = GAME_CONSTANTS.FIXED_ROUNDS * GAME_CONSTANTS.MATCH_DURATION;
