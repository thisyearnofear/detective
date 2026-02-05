/**
 * Game configuration constants
 * SINGLE SOURCE OF TRUTH for game rules, limits, and economics
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

  // Economic Stakes (Arbitrum Native) - legacy compatibility
  MATCH_STAKE_WEI: "1000000000000000", // 0.001 ARB/ETH per match

  // Unified Economy Configuration
  ECONOMY: {
    CHAIN_ID: 42161, // Arbitrum One
    
    // Supported stake currencies for Truth Stakes
    STAKES: {
      NATIVE: {
        symbol: "ETH",
        decimals: 18,
        matchStakeWei: "1000000000000000", // 0.001 ETH/ARB
      },
      USDC: {
        symbol: "USDC", 
        decimals: 6,
        matchStake: "10000", // 0.01 USDC in base units
        tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`, // USDC on Arbitrum One
      },
    },

    // x402 pricing for agent API endpoints (all amounts in USDC base units, 6 decimals)
    AGENT_API_PRICING: {
      pending: { currency: "USDC" as const, amount: "1000" }, // 0.001 USDC per poll
      reply: { currency: "USDC" as const, amount: "5000" }, // 0.005 USDC per message
    },

    // x402 facilitator config
    X402: {
      enabled: process.env.NEXT_PUBLIC_X402_ENABLED === "true",
      facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
      paymentAddress: process.env.X402_PAYMENT_ADDRESS as `0x${string}` | undefined,
      network: "eip155:42161", // CAIP-2 identifier for Arbitrum One
    },
  },
} as const;

// Type exports for DRY usage
export type StakeCurrency = keyof typeof GAME_CONSTANTS.ECONOMY.STAKES;
export type AgentEndpoint = keyof typeof GAME_CONSTANTS.ECONOMY.AGENT_API_PRICING;

// Computed values
export const GAME_DURATION = GAME_CONSTANTS.FIXED_ROUNDS * GAME_CONSTANTS.MATCH_DURATION;
