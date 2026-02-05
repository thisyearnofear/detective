/**
 * Farcaster-Aware Wallet Provider
 * 
 * Single source of truth for wallet interactions that works in BOTH contexts:
 * - Within Farcaster miniapp (uses Farcaster SDK's wallet provider)
 * - Outside Farcaster (uses window.ethereum or fallback)
 * 
 * This fixes wallet interaction within the miniapp context by:
 * 1. Detecting if we're in a Farcaster miniapp
 * 2. Using sdk.wallet.getEthereumProvider() for miniapp context
 * 3. Falling back to window.ethereum for browser wallets
 * 
 * Reference: https://miniapps.farcaster.xyz/docs/guides/wallets
 */

import { miniApp } from './farcasterAuth';

export interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

let cachedProvider: EthereumProvider | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5000; // 5 second cache to handle timing issues

/**
 * Get the appropriate Ethereum provider based on context
 * 
 * In Farcaster miniapp: Uses sdk.wallet.getEthereumProvider()
 * Outside miniapp: Falls back to window.ethereum
 * 
 * Re-attempts fetch if cache is stale (handles initialization timing on mobile)
 * 
 * @returns EthereumProvider or null if none available
 */
export async function getEthereumProvider(): Promise<EthereumProvider | null> {
  const now = Date.now();
  
  // Return cached provider if still valid (within 5s)
  if (cachedProvider && now - cacheTime < CACHE_DURATION) {
    return cachedProvider;
  }

  // Try Farcaster SDK wallet first (works if available, regardless of context)
  try {
    console.log('[FarcasterWalletProvider] Attempting Farcaster SDK wallet...');
    const provider = await miniApp.wallet.getEthereumProvider();
    
    if (provider && typeof provider.request === 'function') {
      console.log('[FarcasterWalletProvider] ✓ Farcaster SDK wallet available');
      cachedProvider = provider as EthereumProvider;
      cacheTime = now;
      return cachedProvider;
    } else {
      console.log('[FarcasterWalletProvider] Farcaster SDK returned invalid provider, trying fallback');
    }
  } catch (error: any) {
    // Check for SDK internal errors that indicate the SDK isn't ready
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes('RpcResponse') ||
      errorMessage.includes("Cannot read properties of undefined")
    ) {
      console.log('[FarcasterWalletProvider] Farcaster SDK not ready, skipping to fallback');
    } else {
      console.log('[FarcasterWalletProvider] Farcaster SDK unavailable, trying fallback:', error);
    }
  }

  // Fallback to window.ethereum (MetaMask, etc.)
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    console.log('[FarcasterWalletProvider] Using window.ethereum provider');
    cachedProvider = (window as any).ethereum;
    cacheTime = now;
    return cachedProvider;
  }

  console.warn('[FarcasterWalletProvider] No wallet provider available');
  cachedProvider = null;
  return null;
}

/**
 * Request account access from the user
 * 
 * Works in both Farcaster miniapp and browser contexts
 * 
 * @returns Array of account addresses, or null if user rejects
 */
export async function requestAccounts(): Promise<string[] | null> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('No wallet provider available. If in Farcaster, ensure your wallet is connected. Otherwise, install MetaMask or another Web3 wallet.');
  }

  try {
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet accounts available');
    }
    
    console.log('[FarcasterWalletProvider] Accounts requested:', accounts);
    return accounts;
  } catch (error: any) {
    // Handle user rejection
    if (error.code === 4001) {
      console.warn('[FarcasterWalletProvider] User rejected account access');
      return null;
    }
    
    // Handle Farcaster SDK internal RPC errors (e.g., RpcResponse.InternalErrorError)
    // These occur when the SDK's response parsing fails due to unexpected response format
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes('RpcResponse') ||
      errorMessage.includes("Cannot read properties of undefined (reading 'error')") ||
      errorMessage.includes("Cannot read properties of undefined (reading 'result')")
    ) {
      console.warn('[FarcasterWalletProvider] Farcaster SDK RPC parsing error, resetting and retrying...');
      
      // Reset cache and try fallback to window.ethereum if available
      cachedProvider = null;
      cacheTime = 0;
      
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        console.log('[FarcasterWalletProvider] Retrying with window.ethereum fallback');
        try {
          const fallbackAccounts = await (window as any).ethereum.request({
            method: 'eth_requestAccounts',
          });
          if (fallbackAccounts && fallbackAccounts.length > 0) {
            console.log('[FarcasterWalletProvider] Fallback accounts:', fallbackAccounts);
            return fallbackAccounts;
          }
        } catch (fallbackError: any) {
          console.warn('[FarcasterWalletProvider] Fallback also failed:', fallbackError.message);
        }
      }
      
      // If we're in Farcaster context but SDK failed, provide a clearer error
      throw new Error('Wallet connection failed. Please try refreshing the app or reconnecting your wallet.');
    }
    
    throw error;
  }
}

/**
 * Send a transaction through the wallet provider
 * 
 * @param txParams Transaction parameters
 * @returns Transaction hash
 */
export async function sendTransaction(txParams: {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  nonce?: number;
}): Promise<string> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  try {
    const txHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    })) as string;

    if (!txHash || typeof txHash !== 'string') {
      throw new Error('Failed to send transaction');
    }

    console.log('[FarcasterWalletProvider] Transaction sent:', txHash);
    return txHash;
  } catch (error: any) {
    if (error.code === 4001) {
      console.warn('[FarcasterWalletProvider] User rejected transaction');
      throw new Error('Transaction rejected');
    }
    throw error;
  }
}

/**
 * Switch to a specific Ethereum chain
 * 
 * @param chainId Chain ID in hex format (e.g., '0xa4b1' for Arbitrum)
 */
export async function switchChain(chainId: string): Promise<void> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    
    console.log('[FarcasterWalletProvider] Switched to chain:', chainId);
  } catch (error: any) {
    if (error.code === 4902) {
      // Chain not found, might need to add it
      throw new Error('Chain not configured in wallet');
    }
    throw error;
  }
}

/**
 * Add a new chain to the wallet
 * 
 * @param chainConfig Chain configuration
 */
export async function addChain(chainConfig: {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls?: string[];
}): Promise<void> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [chainConfig],
    });
    
    console.log('[FarcasterWalletProvider] Added chain:', chainConfig.chainName);
  } catch (error: any) {
    if (error.code === 4001) {
      console.warn('[FarcasterWalletProvider] User rejected chain addition');
      throw new Error('Chain addition rejected');
    }
    throw error;
  }
}

/**
 * Request ERC-7715 Permissions (Session Keys)
 * 
 * Enables "Zero-Click" interactions by requesting a session-based permission
 * for specific contract calls.
 * 
 * @param permissions ERC-7715 permission request object
 * @returns Granted permissions or null if rejected
 */
export async function requestPermissions(permissions: any[] | any): Promise<any | null> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  // ERC-7715 uses 'wallet_grantPermissions'
  // Some older implementations might use 'wallet_requestPermissions'
  const method = 'wallet_grantPermissions';
  
  try {
    console.log(`[FarcasterWalletProvider] Requesting permissions via ${method}...`);
    
    // Ensure params is an array. wallet_grantPermissions usually takes [requestObject]
    const params = Array.isArray(permissions) ? permissions : [permissions];
    
    const response = await provider.request({
      method,
      params,
    });
    
    console.log('[FarcasterWalletProvider] Permissions granted:', response);
    return response;
  } catch (error: any) {
    if (error.code === 4001) {
      console.warn('[FarcasterWalletProvider] User rejected permissions');
      return null;
    }
    
    // Fallback for wallets that might not support the new method yet
    if (error.code === -32601) {
      console.warn(`[FarcasterWalletProvider] ${method} not supported, trying fallback...`);
      try {
        const fallbackResponse = await provider.request({
          method: 'wallet_requestPermissions',
          params: Array.isArray(permissions) ? permissions : [permissions],
        });
        return fallbackResponse;
      } catch (fallbackError: any) {
        console.warn('[FarcasterWalletProvider] Fallback also failed:', fallbackError.message);
        throw new Error('This wallet does not support session permissions (ERC-7715). Please use a smart account wallet.');
      }
    }
    throw error;
  }
}

/**
 * Get transaction receipt
 * 
 * @param txHash Transaction hash
 * @returns Transaction receipt or null if not yet mined
 */
export async function getTransactionReceipt(txHash: string): Promise<any | null> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  try {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    return receipt || null;
  } catch (error) {
    console.error('[FarcasterWalletProvider] Failed to fetch transaction status:', error);
    throw error;
  }
}

/**
 * Send calls using a session context (ERC-5792 + ERC-7715)
 * 
 * This enables background execution of contract calls without user popups,
 * provided a valid session context is available.
 * 
 * @param calls Array of calls to execute
 * @param permissionsContext The context string returned by wallet_grantPermissions
 * @returns Call bundle identifier
 */
export async function sendSessionCalls(
  calls: Array<{
    to: `0x${string}`;
    data?: `0x${string}`;
    value?: `0x${string}`;
  }>,
  permissionsContext: string
): Promise<string> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  try {
    console.log('[FarcasterWalletProvider] Executing session calls with context...');
    
    // ERC-5792 wallet_sendCalls
    const response = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '1.0',
          chainId: '0xa4b1', // Arbitrum One
          calls,
          capabilities: {
            permissions: {
              context: permissionsContext,
            },
          },
        },
      ],
    });
    
    console.log('[FarcasterWalletProvider] Session calls submitted:', response);
    return response;
  } catch (error: any) {
    console.error('[FarcasterWalletProvider] Session calls failed:', error);
    throw error;
  }
}

/**
 * Get the status of a call bundle
 * 
 * @param bundleId The identifier returned by wallet_sendCalls
 */
export async function getCallsStatus(bundleId: string): Promise<any> {
  const provider = await getEthereumProvider();
  
  if (!provider) {
    throw new Error('Wallet not found');
  }

  try {
    const status = await provider.request({
      method: 'wallet_getCallsStatus',
      params: [bundleId],
    });
    
    return status;
  } catch (error) {
    console.error('[FarcasterWalletProvider] Failed to get calls status:', error);
    throw error;
  }
}

/**
 * Reset cached provider (useful for testing or wallet switching)
 */
export function resetProvider(): void {
  cachedProvider = null;
  cacheTime = 0;
  console.log('[FarcasterWalletProvider] Provider cache reset');
}
