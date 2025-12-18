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

import { miniApp, isFarcasterMiniApp } from './farcasterAuth';

export interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

let cachedProvider: EthereumProvider | null = null;
let isInitialized = false;

/**
 * Get the appropriate Ethereum provider based on context
 * 
 * In Farcaster miniapp: Uses sdk.wallet.getEthereumProvider()
 * Outside miniapp: Falls back to window.ethereum
 * 
 * @returns EthereumProvider or null if none available
 */
export async function getEthereumProvider(): Promise<EthereumProvider | null> {
  // Return cached provider if already initialized
  if (isInitialized) {
    return cachedProvider;
  }

  // Check if we're in a Farcaster miniapp context
  if (isFarcasterMiniApp()) {
    try {
      console.log('[FarcasterWalletProvider] Detected Farcaster miniapp context');
      const provider = await miniApp.wallet.getEthereumProvider();
      if (provider) {
        console.log('[FarcasterWalletProvider] Using Farcaster wallet provider');
        cachedProvider = provider as EthereumProvider;
        isInitialized = true;
        return cachedProvider;
      }
    } catch (error) {
      console.error('[FarcasterWalletProvider] Failed to get Farcaster wallet provider:', error);
    }
  }

  // Fallback to window.ethereum (MetaMask, etc.)
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    console.log('[FarcasterWalletProvider] Using window.ethereum provider');
    cachedProvider = (window as any).ethereum;
    isInitialized = true;
    return cachedProvider;
  }

  console.warn('[FarcasterWalletProvider] No wallet provider available');
  isInitialized = true;
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
    throw new Error('Wallet not found');
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
    if (error.code === 4001) {
      console.warn('[FarcasterWalletProvider] User rejected account access');
      return null;
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
 * Reset cached provider (useful for testing or wallet switching)
 */
export function resetProvider(): void {
  cachedProvider = null;
  isInitialized = false;
  console.log('[FarcasterWalletProvider] Provider cache reset');
}
