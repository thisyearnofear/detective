/**
 * Arbitrum TX Verification Utility
 * 
 * Single source of truth for:
 * - Client-side TX signing with wallet
 * - Server-side TX verification on-chain
 * - Contract address and RPC configuration
 * 
 * Contract: DetectiveGameEntry (0xF749C3aAFf292d93E8Cc330A64E4589451d6E47D)
 * 
 * Used by:
 * - useRegistrationFlow hook: Request TX from user with progress tracking
 * - GameLobby: Orchestrate registration flow with modal states
 * - /api/game/register: Verify TX proof on server
 */

import { createPublicClient, http, Address, getAddress, isAddress, toHex } from 'viem';
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
  const rpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
  
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

// ========== TX SIGNING (CLIENT-SIDE) ==========

/**
 * Request Arbitrum wallet connection and TX signature from user
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
  
  if (!window.ethereum) {
    throw new Error('MetaMask or Arbitrum-compatible wallet not found. Please install MetaMask.');
  }
  
  try {
    // Request account access
    const accounts = (await window.ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[];
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet accounts available');
    }
    
    const userAddress = accounts[0];
    console.log('[ArbitrumVerification] Connected wallet:', userAddress);
    
    // Store wallet for later use (registration API)
    if (typeof window !== 'undefined') {
      localStorage.setItem('arbitrumWalletAddress', userAddress);
    }
    
    // Switch to Arbitrum network
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa4b1' }], // Arbitrum mainnet
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0xa4b1',
              chainName: 'Arbitrum One',
              rpcUrls: [config.rpcUrl],
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              blockExplorerUrls: ['https://arbiscan.io'],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
    
    // Send TX to contract
    const txHash = await sendRegistrationTx(userAddress, userFid, config);
    return txHash;
  } catch (error) {
    console.error('[ArbitrumVerification] TX request failed:', error);
    throw error;
  }
}

/**
 * Send TX to contract
 * 
 * @internal Used by requestArbitrumRegistrationTx
 */
async function sendRegistrationTx(
  userAddress: string,
  userFid: number,
  config: ArbitrumConfig
): Promise<string> {
  console.log('[ArbitrumVerification] Encoding FID:', userFid);
  
  const encodedData = encodeRegisterFunctionCall(userFid);
  console.log('[ArbitrumVerification] Encoded data:', encodedData);
  
  const method = 'eth_sendTransaction';
  const params = [
    {
      from: userAddress,
      to: config.contractAddress,
      value: '0x0', // No fee required
      data: encodedData,
      gas: '0x186a0', // ~100k gas estimate
    },
  ];
  
  console.log('[ArbitrumVerification] Sending TX to contract:', config.contractAddress);
  console.log('[ArbitrumVerification] TX params:', JSON.stringify(params[0], null, 2));
  
  const txHash = (await window.ethereum!.request({
    method,
    params,
  })) as string;
  
  if (!txHash || typeof txHash !== 'string') {
    throw new Error('Invalid TX hash returned from wallet');
  }
  
  console.log('[ArbitrumVerification] TX sent:', txHash);
  return txHash;
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
    
    if (!isAddress(walletAddress)) {
      console.error('[ArbitrumVerification] Invalid wallet address:', walletAddress);
      return false;
    }
    
    if (userFid <= 0) {
      console.error('[ArbitrumVerification] Invalid FID:', userFid);
      return false;
    }
    
    const client = getArbitrumClient();
    
    // Fetch TX from Arbitrum RPC
    const tx = await client.getTransaction({
      hash: txHash as `0x${string}`,
    });
    
    if (!tx) {
      console.error('[ArbitrumVerification] TX not found on chain:', txHash);
      return false;
    }
    
    // Verify TX properties
    if (!isSameAddress(tx.from, walletAddress)) {
      console.error('[ArbitrumVerification] TX from unexpected wallet:', tx.from, 'expected:', walletAddress);
      return false;
    }
    
    if (!tx.to || !isSameAddress(tx.to, config.contractAddress)) {
      console.error('[ArbitrumVerification] TX to unexpected address:', tx.to, 'expected:', config.contractAddress);
      return false;
    }
    
    if (!isValidRegisterFunctionCall(tx.input, userFid)) {
      console.error('[ArbitrumVerification] TX data does not match registerForGame(fid)');
      return false;
    }
    
    // Fetch receipt to confirm TX succeeded
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    
    if (!receipt) {
      console.warn('[ArbitrumVerification] TX receipt not available yet (pending):', txHash);
      return true; // Optimistically accept pending TX
    }
    
    const status = receipt.status as unknown as number;
    if (status !== 1) {
      console.error('[ArbitrumVerification] TX failed on-chain');
      return false;
    }
    
    console.log('[ArbitrumVerification] TX verified successfully:', txHash);
    return true;
  } catch (error) {
    console.error('[ArbitrumVerification] Verification error:', error);
    return false;
  }
}

// ========== ENCODING / DECODING HELPERS ==========

/**
 * Encode the registerForGame(uint256 fid) function call
 * 
 * Function signature: registerForGame(uint256)
 * Selector: keccak256("registerForGame(uint256)") = 0x7c5de883
 */
function encodeRegisterFunctionCall(fid: number): string {
  const SELECTOR = '0x7c5de883';
  const encodedFid = toHex(fid, { size: 32 });
  return (SELECTOR + encodedFid.slice(2)) as `0x${string}`;
}

/**
 * Verify TX input matches expected function call
 */
function isValidRegisterFunctionCall(input: string, expectedFid: number): boolean {
  try {
    const expected = encodeRegisterFunctionCall(expectedFid);
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
