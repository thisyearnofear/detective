/**
 * Arbitrum TX Verification Utility
 * 
 * Single source of truth for:
 * - Client-side TX signing with wallet
 * - Server-side TX verification on-chain
 * - Contract address and RPC configuration
 * 
 * Contract: DetectiveGameEntry (0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460)
 * 
 * Used by:
 * - useRegistrationFlow hook: Request TX from user with progress tracking
 * - BriefingRoom: Orchestrate investigation join flow with modal states
 * - /api/game/register: Verify TX proof on server
 */

import { createPublicClient, http, Address, getAddress, isAddress } from 'viem';
import { arbitrum } from 'viem/chains';

// ========== CONFIGURATION ==========

export interface ArbitrumConfig {
  enabled: boolean;
  contractAddress: Address;
  rpcUrl: string;
}

export function getArbitrumConfig(): ArbitrumConfig {
  const enabled = process.env.NEXT_PUBLIC_ARBITRUM_ENABLED === 'true';
  const contractAddress = process.env.NEXT_PUBLIC_ARBITRUM_ENTRY_CONTRACT as Address | undefined;
  // Server-side: prefer ARBITRUM_RPC_URL, fall back to NEXT_PUBLIC_ version
  // Client-side: only NEXT_PUBLIC_ version is available
  const rpcUrl = process.env.ARBITRUM_RPC_URL || process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
  
  if (enabled && !contractAddress) {
    console.error('[ArbitrumVerification] ARBITRUM_ENABLED=true but contract address missing');
  }
  
  return {
    enabled,
    contractAddress: contractAddress || ('0x' as Address),
    rpcUrl,
  };
}

// ========== CLIENT SETUP ==========

let arbitrumClient: ReturnType<typeof createPublicClient> | null = null;

function getArbitrumClient() {
  if (!arbitrumClient) {
    const config = getArbitrumConfig();
    arbitrumClient = createPublicClient({
      chain: arbitrum,
      transport: http(config.rpcUrl),
    });
  }
  return arbitrumClient;
}

/**
 * Check if a wallet is already registered on-chain
 * 
 * @param walletAddress The wallet address to check
 * @returns true if already registered, false otherwise
 */
export async function isWalletRegisteredOnChain(walletAddress: string): Promise<boolean> {
  const config = getArbitrumConfig();
  
  if (!config.enabled || !config.contractAddress || config.contractAddress === '0x') {
    return false;
  }

  try {
    const client = getArbitrumClient();
    
    // isWalletRegistered(address) selector: 0x7f247e49
    const selector = '0x7f247e49';
    const paddedAddr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = selector + paddedAddr;
    
    const result = await client.call({
      to: config.contractAddress,
      data: callData as `0x${string}`,
    });

    // Result is 0x...001 for true, 0x...000 for false
    const isRegistered = result.data?.endsWith('1') ?? false;
    console.log(`[ArbitrumVerification] isWalletRegistered(${walletAddress.slice(0, 10)}...): ${isRegistered}`);
    return isRegistered;
  } catch (error) {
    console.error('[ArbitrumVerification] Failed to check wallet registration:', error);
    return false;
  }
}

// ========== TX SIGNING (CLIENT-SIDE) ==========

/**
 * Request Arbitrum wallet connection and TX signature from user
 * 
 * IMPORTANT: Works in both browser and Farcaster miniapp contexts
 * 
 * @param userFid The Farcaster FID to register
 * @returns TX hash if successful, null if user rejects
 */
export async function requestArbitrumRegistrationTx(userFid: number): Promise<string | null> {
  const config = getArbitrumConfig();
  
  if (!config.enabled) {
    console.log('[ArbitrumVerification] Arbitrum gating disabled');
    return null;
  }
  
  try {
    // Import the Farcaster-aware wallet provider
    const { requestAccounts, switchChain, addChain, sendTransaction } = await import('./farcasterWalletProvider');
    
    // Step 1: Request account access (works in both miniapp and browser contexts)
    const accounts = await requestAccounts();
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet accounts available');
    }
    
    const userAddress = accounts[0];
    console.log('[ArbitrumVerification] Connected wallet:', userAddress);
    
    // Store wallet for later use (registration API)
    if (typeof window !== 'undefined') {
      localStorage.setItem('arbitrumWalletAddress', userAddress);
    }
    
    // Step 2: Switch to Arbitrum network
    try {
      await switchChain('0xa4b1'); // Arbitrum mainnet
    } catch (switchError: any) {
      // Chain not found, try to add it
      if (switchError.message?.includes('not found')) {
        await addChain({
          chainId: '0xa4b1',
          chainName: 'Arbitrum One',
          rpcUrls: [config.rpcUrl],
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          blockExplorerUrls: ['https://arbiscan.io'],
        });
      } else {
        throw switchError;
      }
    }
    
    // Step 3: Encode and send TX to contract
    const encodedData = encodeRegisterFunctionCall(userFid);
    const txHash = await sendTransaction({
      from: userAddress,
      to: config.contractAddress,
      value: '0x0', // No fee required
      data: encodedData,
      gas: '0x186a0', // ~100k gas estimate
    });
    
    return txHash;
  } catch (error) {
    console.error('[ArbitrumVerification] TX request failed:', error);
    throw error;
  }
}



// ========== TX VERIFICATION (SERVER-SIDE) ==========

/**
 * Verify TX on server before allowing registration
 * 
 * @param txHash The TX hash from client
 * @param walletAddress The wallet that sent the TX
 * @param userFid The FID that was registered
 * @returns true if TX is valid and confirmed on-chain
 */
export async function verifyArbitrumTx(
  txHash: string,
  walletAddress: string,
  userFid: number
): Promise<boolean> {
  const config = getArbitrumConfig();
  
  console.log('[ArbitrumVerification] Starting verification:', {
    txHash,
    walletAddress,
    userFid,
    configEnabled: config.enabled,
    contractAddress: config.contractAddress,
    rpcUrl: config.rpcUrl,
  });
  
  if (!config.enabled) {
    console.log('[ArbitrumVerification] Verification disabled');
    return true;
  }
  
  try {
    // Validate inputs
    if (!isValidTxHash(txHash)) {
      console.error('[ArbitrumVerification] Invalid TX hash format:', txHash);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ TX hash format valid');
    
    if (!isAddress(walletAddress)) {
      console.error('[ArbitrumVerification] Invalid wallet address:', walletAddress);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ Wallet address valid');
    
    if (userFid <= 0) {
      console.error('[ArbitrumVerification] Invalid FID:', userFid);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ FID valid');
    
    const client = getArbitrumClient();
    console.log('[ArbitrumVerification] Fetching TX from chain...');
    
    // Fetch TX from Arbitrum RPC
    const tx = await client.getTransaction({
      hash: txHash as `0x${string}`,
    });
    
    if (!tx) {
      console.error('[ArbitrumVerification] TX not found on chain:', txHash);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ TX found on chain');
    console.log('[ArbitrumVerification] TX details:', {
      from: tx.from,
      to: tx.to,
      input: tx.input,
    });
    
    // Verify TX properties
    if (!isSameAddress(tx.from, walletAddress)) {
      console.error('[ArbitrumVerification] TX from unexpected wallet:', tx.from, 'expected:', walletAddress);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ From address matches');
    
    if (!tx.to || !isSameAddress(tx.to, config.contractAddress)) {
      console.error('[ArbitrumVerification] TX to unexpected address:', tx.to, 'expected:', config.contractAddress);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ To address matches contract');
    
    const expectedData = encodeRegisterFunctionCall(userFid);
    console.log('[ArbitrumVerification] Comparing TX input:', {
      actual: tx.input,
      expected: expectedData,
      match: tx.input.toLowerCase() === expectedData.toLowerCase(),
    });
    
    if (!isValidRegisterFunctionCall(tx.input, userFid)) {
      console.error('[ArbitrumVerification] TX data does not match registerForGame(fid)');
      console.error('[ArbitrumVerification] Expected:', expectedData);
      console.error('[ArbitrumVerification] Actual:', tx.input);
      return false;
    }
    console.log('[ArbitrumVerification] ✓ Function call data matches');
    
    // Fetch receipt to confirm TX succeeded
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    
    if (!receipt) {
      console.warn('[ArbitrumVerification] TX receipt not available yet (pending):', txHash);
      return true; // Optimistically accept pending TX
    }
    
    console.log('[ArbitrumVerification] Receipt status:', receipt.status, 'type:', typeof receipt.status);
    
    // viem returns status as 'success' or 'reverted' (string)
    if (receipt.status !== 'success') {
      console.error('[ArbitrumVerification] TX failed on-chain, status:', receipt.status);
      return false;
    }
    
    console.log('[ArbitrumVerification] ✓ TX verified successfully:', txHash);
    return true;
  } catch (error) {
    console.error('[ArbitrumVerification] Verification error:', error);
    return false;
  }
}

// ========== ENCODING / DECODING HELPERS ==========

/**
 * Encode the registerForGame() function call
 * 
 * Function signature: registerForGame()
 * Selector: keccak256("registerForGame()") = 0xdaeded60
 * 
 * NOTE: V3 contract takes no parameters - FID is verified off-chain by backend
 * 
 * EXPORTED: Used by useRegistrationFlow and requestArbitrumRegistrationTx
 */
export function encodeRegisterFunctionCall(_fid?: number): string {
  // V3 contract: registerForGame() takes no arguments
  const SELECTOR = '0xdaeded60';
  return SELECTOR as `0x${string}`;
}

/**
 * Verify TX input matches expected function call
 */
function isValidRegisterFunctionCall(input: string, _expectedFid?: number): boolean {
  try {
    const expected = encodeRegisterFunctionCall();
    return input.toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

// ========== VALIDATION HELPERS ==========

function isValidTxHash(hash: string): boolean {
  return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash);
}

function isSameAddress(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}
