/**
 * Contract Utility Functions
 * 
 * Helper functions for interacting with DetectiveGameEntry contract:
 * - Registration signature generation
 * - Stake amount validation
 * - Deadline calculation
 * - Match ID hashing
 */

import { keccak256, toHex, encodePacked } from 'viem';
import { 
  CONTRACT_ADDRESS, 
  STAKE_LIMITS,
  type DetectiveGameEntryErrors 
} from './detectiveGameEntryAbi';
import { type StakeCurrency } from './gameConstants';

// Chain ID for Arbitrum One
const ARBITRUM_CHAIN_ID = 42161;

/**
 * Interface for registration signature data
 */
export interface RegistrationSignatureData {
  signature: `0x${string}`;
  deadline: bigint;
  nonce: bigint;
}

/**
 * Creates a registration signature for the contract
 * 
 * @param wallet Wallet client with signing capability
 * @param fid Farcaster ID to register
 * @param customDeadline Optional custom deadline (defaults to 5 min)
 * @returns Signature data for registerForGame call
 * 
 * @example
 * ```typescript
 * const { signature, deadline, nonce } = await createRegistrationSignature(
 *   wallet,
 *   12345
 * );
 * 
 * await wallet.writeContract({
 *   address: CONTRACT_ADDRESS,
 *   abi: DETECTIVE_GAME_ENTRY_ABI,
 *   functionName: 'registerForGame',
 *   args: [BigInt(fid), nonce, deadline, signature],
 *   value: entryFee,
 * });
 * ```
 */
export async function createRegistrationSignature(
  wallet: {
    account: { address: `0x${string}` };
    signMessage: (args: { message: { raw: `0x${string}` } }) => Promise<`0x${string}`>;
  },
  fid: number,
  customDeadline?: number
): Promise<RegistrationSignatureData> {
  const nonce = BigInt(Date.now());
  const deadline = BigInt(customDeadline || Math.floor(Date.now() / 1000) + 300);
  
  // Create the message hash (matches contract's hashing logic)
  const messageHash = keccak256(encodePacked(
    ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [
      wallet.account.address,
      BigInt(fid),
      nonce,
      deadline,
      CONTRACT_ADDRESS,
      BigInt(ARBITRUM_CHAIN_ID)
    ]
  ));
  
  // Create Ethereum signed message hash
  const ethSignedMessageHash = keccak256(encodePacked(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', messageHash]
  ));
  
  // Sign the message
  const signature = await wallet.signMessage({
    message: { raw: ethSignedMessageHash },
  });
  
  return { signature, deadline, nonce };
}

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
    InvalidFID: 'Invalid Farcaster ID',
    InvalidAmount: 'Invalid amount',
    InvalidMatchId: 'Invalid match ID',
    InvalidDeadline: 'Invalid deadline',
    StakeTooHigh: `Stake exceeds maximum (${formatStakeAmount(BigInt(STAKE_LIMITS.native.max), 'NATIVE')} or ${formatStakeAmount(BigInt(STAKE_LIMITS.usdc.max), 'USDC')})`,
    StakeTooLow: `Stake below minimum (${formatStakeAmount(BigInt(STAKE_LIMITS.native.min), 'NATIVE')} or ${formatStakeAmount(BigInt(STAKE_LIMITS.usdc.min), 'USDC')})`,
    InsufficientFee: 'Insufficient entry fee',
    FIDAlreadyRegistered: 'This Farcaster ID is already registered',
    WalletAlreadyRegistered: 'This wallet is already registered',
    InvalidSignature: 'Invalid registration signature',
    ExpiredDeadline: 'Transaction deadline has expired',
    NotAdmin: 'Caller is not admin',
    TransferFailed: 'Native token transfer failed',
    USDCTransferFailed: 'USDC transfer failed',
  };
  
  return messages[error] || 'Unknown contract error';
}

/**
 * Pre-computed stake limits for client-side validation
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
