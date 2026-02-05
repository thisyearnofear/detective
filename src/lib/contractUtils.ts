/**
 * Contract Utility Functions
 * 
 * Helper functions for interacting with DetectiveGameEntry V3:
 * - Stake amount validation
 * - Deadline calculation
 * - Match ID hashing
 * - Error message formatting
 */

import { keccak256, toHex } from 'viem';
import { 
  CONTRACT_ADDRESS, 
  STAKE_LIMITS,
  type DetectiveGameEntryErrors 
} from './detectiveGameEntryAbi';
import { type StakeCurrency } from './gameConstants';

// Chain ID for Arbitrum One
export const ARBITRUM_CHAIN_ID = 42161;

/**
 * Validates a native stake amount
 * 
 * @param amount Amount in wei
 * @returns True if valid, error name if invalid
 */
export function validateNativeStake(amount: bigint): true | DetectiveGameEntryErrors {
  if (amount < BigInt(STAKE_LIMITS.native.min)) {
    return 'StakeTooLow';
  }
  if (amount > BigInt(STAKE_LIMITS.native.max)) {
    return 'StakeTooHigh';
  }
  return true;
}

/**
 * Validates a USDC stake amount
 * 
 * @param amount Amount in USDC base units (6 decimals)
 * @returns True if valid, error name if invalid
 */
export function validateUSDCStake(amount: bigint): true | DetectiveGameEntryErrors {
  if (amount < BigInt(STAKE_LIMITS.usdc.min)) {
    return 'StakeTooLow';
  }
  if (amount > BigInt(STAKE_LIMITS.usdc.max)) {
    return 'StakeTooHigh';
  }
  return true;
}

/**
 * Validates any stake amount based on currency
 * 
 * @param amount Amount in base units
 * @param currency 'NATIVE' or 'USDC'
 * @returns True if valid, error name if invalid
 */
export function validateStake(
  amount: bigint,
  currency: StakeCurrency
): true | DetectiveGameEntryErrors {
  return currency === 'USDC' 
    ? validateUSDCStake(amount)
    : validateNativeStake(amount);
}

/**
 * Calculates a deadline timestamp
 * 
 * @param minutesFromNow Minutes from now (defaults to 5)
 * @returns Unix timestamp in seconds
 */
export function calculateDeadline(minutesFromNow: number = 5): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutesFromNow * 60);
}

/**
 * Hashes a match ID string to bytes32
 * 
 * @param matchId Match ID string or existing bytes32
 * @returns bytes32 hash
 */
export function hashMatchId(matchId: string): `0x${string}` {
  if (matchId.startsWith('0x') && matchId.length === 66) {
    return matchId as `0x${string}`;
  }
  return keccak256(toHex(matchId));
}

/**
 * Formats a stake amount for display
 * 
 * @param amount Amount in base units
 * @param currency 'NATIVE' or 'USDC'
 * @returns Formatted string with symbol
 */
export function formatStakeAmount(
  amount: bigint,
  currency: StakeCurrency
): string {
  if (currency === 'USDC') {
    const value = Number(amount) / 1e6;
    return `${value.toFixed(2)} USDC`;
  } else {
    const value = Number(amount) / 1e18;
    return `${value.toFixed(4)} ETH`;
  }
}

/**
 * Parses a stake amount from user input
 * 
 * @param input User input string (e.g., "0.01" or "10")
 * @param currency 'NATIVE' or 'USDC'
 * @returns Amount in base units
 * @throws Error if invalid input
 */
export function parseStakeAmount(
  input: string,
  currency: StakeCurrency
): bigint {
  const value = parseFloat(input);
  if (isNaN(value) || value <= 0) {
    throw new Error('Invalid amount');
  }
  
  if (currency === 'USDC') {
    return BigInt(Math.round(value * 1e6));
  } else {
    return BigInt(Math.round(value * 1e18));
  }
}

/**
 * Gets human-readable error message for contract errors
 * 
 * @param error Error name from contract
 * @returns Human-readable message
 */
export function getContractErrorMessage(error: DetectiveGameEntryErrors): string {
  const messages: Record<DetectiveGameEntryErrors, string> = {
    ContractPaused: 'Contract is currently paused',
    InvalidAddress: 'Invalid address provided',
    InvalidAmount: 'Invalid amount',
    InvalidMatchId: 'Invalid match ID',
    InvalidDeadline: 'Invalid deadline',
    StakeTooHigh: `Stake exceeds maximum (${formatStakeAmount(BigInt(STAKE_LIMITS.native.max), 'NATIVE')} or ${formatStakeAmount(BigInt(STAKE_LIMITS.usdc.max), 'USDC')})`,
    StakeTooLow: `Stake below minimum (${formatStakeAmount(BigInt(STAKE_LIMITS.native.min), 'NATIVE')} or ${formatStakeAmount(BigInt(STAKE_LIMITS.usdc.min), 'USDC')})`,
    InsufficientFee: 'Insufficient entry fee',
    AlreadyRegistered: 'This wallet is already registered',
    NotRegistered: 'Wallet not registered. Please register first.',
    AlreadyVoted: 'You have already voted on this match',
    AlreadyStaked: 'You have already staked on this match',
    ExpiredDeadline: 'Transaction deadline has expired',
    NotAdmin: 'Caller is not admin',
    TransferFailed: 'Token transfer failed',
    USDCTransferFailed: 'USDC transfer failed (check approval)',
  };
  
  return messages[error] || 'Unknown contract error';
}

/**
 * Pre-computed stake limits for display
 */
export const STAKE_LIMITS_DISPLAY = {
  native: {
    min: formatStakeAmount(BigInt(STAKE_LIMITS.native.min), 'NATIVE'),
    max: formatStakeAmount(BigInt(STAKE_LIMITS.native.max), 'NATIVE'),
  },
  usdc: {
    min: formatStakeAmount(BigInt(STAKE_LIMITS.usdc.min), 'USDC'),
    max: formatStakeAmount(BigInt(STAKE_LIMITS.usdc.max), 'USDC'),
  },
} as const;

/**
 * Validates match ID format
 * 
 * @param matchId Match ID to validate
 * @returns True if valid
 */
export function isValidMatchId(matchId: string): boolean {
  // Check if it's a valid bytes32 (0x + 64 hex chars) or a non-empty string
  if (matchId.startsWith('0x')) {
    return matchId.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(matchId);
  }
  return matchId.length > 0 && matchId.length <= 64;
}

/**
 * Creates match ID from components (for consistent ID generation)
 * 
 * @param playerFid Player's Farcaster ID
 * @param opponentFid Opponent's Farcaster ID
 * @param roundNumber Round number
 * @param timestamp Match start timestamp
 * @returns bytes32 match ID
 */
export function createMatchId(
  playerFid: number,
  opponentFid: number,
  roundNumber: number,
  timestamp: number
): `0x${string}` {
  return keccak256(
    toHex(`${playerFid}-${opponentFid}-${roundNumber}-${timestamp}`)
  );
}
