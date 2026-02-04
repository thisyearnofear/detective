/**
 * ERC-7715 Permission Utility
 * 
 * Logic for requesting and validating session-based permissions from 
 * Arbitrum Smart Accounts. This enables "Zero-Click" staking by 
 * allowing the app to execute specific contract calls within a budget.
 */

import { parseEther } from "viem";

// Constants for the Detective Game
export const DEFAULT_SESSION_BUDGET = parseEther("0.01"); // ~0.01 ETH/ARB limit per session
export const SESSION_DURATION_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * Interface for ERC-7715 Permission Request (wallet_grantPermissions)
 * Based on the latest ERC-7715 draft and MetaMask Smart Accounts Kit
 */
export interface ERC7715PermissionRequest {
  expiry: number;
  signer?: {
    type: "keys" | "account";
    data: {
      ids: string[];
    };
  };
  permissions: Array<{
    type: "contract-call";
    data: {
      address: `0x${string}`;
      functions?: Array<{
        name: string;
        abi?: any[];
      }>;
    };
  }>;
  policies?: Array<{
    type: "usage-limit" | "rate-limit" | "time-range" | "value-limit";
    data: any;
  }>;
}

/**
 * Interface for the response from wallet_grantPermissions
 */
export interface ERC7715PermissionResponse {
  grantedPermissions: any[];
  permissionsContext: string;
  expiry: number;
}

/**
 * Formats a permission request for the Detective Game Entry contract.
 * Allows the app to call `registerForGame` or `stakeOnMatch`.
 */
export function formatGamePermissionRequest(
  contractAddress: `0x${string}`,
  budget: bigint = DEFAULT_SESSION_BUDGET
): ERC7715PermissionRequest {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + SESSION_DURATION_SECONDS;

  return {
    expiry,
    permissions: [
      {
        type: "contract-call",
        data: {
          address: contractAddress,
        },
      },
    ],
    policies: [
      {
        type: "time-range",
        data: {
          start: now,
          end: expiry,
        },
      },
      {
        type: "usage-limit",
        data: {
          limit: budget.toString(),
        },
      },
    ],
  };
}

/**
 * Validates if a user's session permission is still valid.
 */
export function isPermissionValid(expiry?: number): boolean {
  if (!expiry) return false;
  // Buffer of 5 minutes to avoid race conditions at end of session
  return Date.now() < (expiry - 300) * 1000;
}

/**
 * Stores session permissions in local storage
 */
export function saveSessionPermissions(response: ERC7715PermissionResponse): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('erc7715_session_context', response.permissionsContext);
  localStorage.setItem('erc7715_session_expiry', response.expiry.toString());
  localStorage.setItem('erc7715_session_granted', JSON.stringify(response.grantedPermissions));
}

/**
 * Retrieves session permissions from local storage
 */
export function getSessionPermissions(): { context: string | null; expiry: number | null } {
  if (typeof window === 'undefined') return { context: null, expiry: null };
  
  const context = localStorage.getItem('erc7715_session_context');
  const expiryStr = localStorage.getItem('erc7715_session_expiry');
  const expiry = expiryStr ? parseInt(expiryStr, 10) : null;
  
  return { context, expiry };
}

/**
 * Clears session permissions
 */
export function clearSessionPermissions(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('erc7715_session_context');
  localStorage.removeItem('erc7715_session_expiry');
  localStorage.removeItem('erc7715_session_granted');
}

/**
 * Executes a background stake for a match using session permissions
 * 
 * @param matchId The match ID to stake on
 * @param isBot The player's current guess
 * @param amountWei The amount to stake in wei
 * @returns Call bundle ID or null if session is invalid
 */
export async function executeSessionStake(
  matchId: string,
  isBot: boolean,
  amountWei: string
): Promise<string | null> {
  const { context, expiry } = getSessionPermissions();
  
  if (!context || !isPermissionValid(expiry || 0)) {
    console.warn('[ERC-7715] No valid session context for background staking');
    return null;
  }

  try {
    const { getArbitrumConfig } = await import('./arbitrumVerification');
    const { sendSessionCalls } = await import('./farcasterWalletProvider');
    const { encodeFunctionData, keccak256, toHex } = await import('viem');
    
    const config = getArbitrumConfig();
    
    // Hash matchId to bytes32 if it's a string
    const hashedMatchId = matchId.startsWith('0x') && matchId.length === 66 
      ? matchId 
      : keccak256(toHex(matchId)) as `0x${string}`;

    // Minimal ABI for stakeOnMatch
    const abi = [{
      name: 'stakeOnMatch',
      type: 'function',
      stateMutability: 'payable',
      inputs: [
        { name: 'matchId', type: 'bytes32' },
        { name: 'isBot', type: 'bool' }
      ],
      outputs: []
    }];

    const callData = encodeFunctionData({
      abi,
      functionName: 'stakeOnMatch',
      args: [hashedMatchId, isBot]
    });

    console.log(`[ERC-7715] Executing background stake for match ${matchId}...`);
    
    const bundleId = await sendSessionCalls(
      [{
        to: config.contractAddress,
        data: callData,
        value: toHex(BigInt(amountWei)) as `0x${string}`
      }],
      context
    );

    return bundleId;
  } catch (error) {
    console.error('[ERC-7715] Background stake failed:', error);
    return null;
  }
}

/**
 * Executes a background vote for a match using session permissions
 * 
 * @param matchId The match ID to vote on
 * @param isBot The player's guess
 * @returns Call bundle ID or null if session is invalid
 */
export async function executeSessionVote(
  matchId: string,
  isBot: boolean
): Promise<string | null> {
  const { context, expiry } = getSessionPermissions();
  
  if (!context || !isPermissionValid(expiry || 0)) {
    return null;
  }

  try {
    const { getArbitrumConfig } = await import('./arbitrumVerification');
    const { sendSessionCalls } = await import('./farcasterWalletProvider');
    const { encodeFunctionData, keccak256, toHex } = await import('viem');
    
    const config = getArbitrumConfig();
    
    const hashedMatchId = matchId.startsWith('0x') && matchId.length === 66 
      ? matchId 
      : keccak256(toHex(matchId)) as `0x${string}`;

    const abi = [{
      name: 'submitVote',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'matchId', type: 'bytes32' },
        { name: 'isBot', type: 'bool' }
      ],
      outputs: []
    }];

    const callData = encodeFunctionData({
      abi,
      functionName: 'submitVote',
      args: [hashedMatchId, isBot]
    });

    console.log(`[ERC-7715] Executing background vote for match ${matchId}...`);
    
    const bundleId = await sendSessionCalls(
      [{
        to: config.contractAddress,
        data: callData
      }],
      context
    );

    return bundleId;
  } catch (error) {
    console.error('[ERC-7715] Background vote failed:', error);
    return null;
  }
}
