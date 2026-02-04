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
 * Interface for ERC-7715 Permission Request
 * Based on the MetaMask Smart Accounts Kit specification
 */
export interface ERC7715PermissionRequest {
  type: "call";
  data: {
    target: `0x${string}`;
    abi?: any[];
    valueLimit?: string; // Max wei per call
  };
  policies: Array<{
    type: "usage-limit" | "rate-limit" | "time-range";
    value: any;
  }>;
}

/**
 * Formats a permission request for the Detective Game Entry contract.
 * Allows the app to call `registerForGame` or `stakeOnMatch`.
 */
export function formatGamePermissionRequest(
  contractAddress: `0x${string}`,
  budget: bigint = DEFAULT_SESSION_BUDGET
): ERC7715PermissionRequest {
  return {
    type: "call",
    data: {
      target: contractAddress,
      // valueLimit: budget.toString(),
    },
    policies: [
      {
        type: "time-range",
        value: {
          start: Math.floor(Date.now() / 1000),
          end: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
        },
      },
      {
        type: "usage-limit",
        value: {
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
