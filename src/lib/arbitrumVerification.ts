/**
 * Arbitrum TX Verification Utility
 * 
 * Single source of truth for:
 * - TX signature requirements
 * - Contract address validation (DetectiveGameEntry on Arbitrum One)
 * - TX proof verification
 * - Error handling
 * 
 * Contract: DetectiveGameEntry (0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff)
 * Verified: https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff
 * 
 * Used by:
 * - useRegistrationFlow hook: Request TX from user with progress tracking
 * - GameLobby: Orchestrate registration flow with modal states
 * - /api/game/register: Verify TX proof on server
 */

import { createPublicClient, http, Address, getAddress, isAddress, toHex } from 'viem';
import { arbitrum } from 'viem/chains';
// Contract ABI available in: src/lib/detectiveGameEntryAbi.ts
// Address: 0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff (Arbitrum One)

// ========== CONFIGURATION ==========

export interface ArbitrumConfig {
  enabled: boolean;
  contractAddress: Address;
  minEntryFee: string; // wei as string for precision
  rpcUrl: string;
}

export function getArbitrumConfig(): ArbitrumConfig {
  const enabled = process.env.NEXT_PUBLIC_ARBITRUM_ENABLED === 'true';
  const contractAddress = process.env.NEXT_PUBLIC_ARBITRUM_ENTRY_CONTRACT as Address | undefined;
  const minEntryFee = process.env.NEXT_PUBLIC_ARBITRUM_MIN_FEE || '0';
  const rpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
  
  if (enabled && !contractAddress) {
    console.error('[ArbitrumVerification] ARBITRUM_ENABLED=true but contract address missing');
  }
  
  return {
    enabled,
    contractAddress: contractAddress || ('0x' as Address),
    minEntryFee,
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
    // Step 1: Request account access
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
    
    // Step 2: Switch to Arbitrum network
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa4b1' }], // Arbitrum mainnet
      });
    } catch (switchError: any) {
      // Error code 4902 means the chain hasn't been added
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
    
    // Step 3: Send TX to contract
    const txHash = await sendRegistrationTx(userAddress, userFid, config);
    return txHash;
  } catch (error) {
    console.error('[ArbitrumVerification] TX request failed:', error);
    throw error;
  }
}

/**
 * Send actual TX to contract
 * 
 * @internal Used by requestArbitrumRegistrationTx
 */
async function sendRegistrationTx(
  userAddress: string,
  userFid: number,
  config: ArbitrumConfig
): Promise<string> {
  const method = 'eth_sendTransaction';
  const params = [
    {
      from: userAddress,
      to: config.contractAddress,
      value: config.minEntryFee, // '0x0' for free, or amount in wei
      data: encodeRegisterFunctionCall(userFid), // Function selector + encoded params
      gas: '0x186a0', // ~100k gas estimate
    },
  ];
  
  console.log('[ArbitrumVerification] Sending TX to contract:', config.contractAddress);
  console.log('[ArbitrumVerification] Encoded call:', params[0].data);
  
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
 * Verify TX on server
 * 
 * Called by /api/game/register before allowing registration
 * 
 * @param txHash The TX hash from client
 * @param walletAddress The wallet that sent the TX
 * @param userFid The FID that was registered
 * @returns true if TX is valid and confirmed
 */
export async function verifyArbitrumTx(
  txHash: string,
  walletAddress: string,
  userFid: number
): Promise<boolean> {
  const config = getArbitrumConfig();
  
  if (!config.enabled) {
    console.log('[ArbitrumVerification] Verification disabled');
    return true; // Allow if feature disabled
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
    
    // Verify TX properties
    if (!tx) {
      console.error('[ArbitrumVerification] TX not found on chain:', txHash);
      return false;
    }
    
    // 1. Check TX was sent from expected wallet
    if (!isSameAddress(tx.from, walletAddress)) {
      console.error('[ArbitrumVerification] TX from unexpected wallet:', tx.from, 'expected:', walletAddress);
      return false;
    }
    
    // 2. Check TX destination is our contract
    if (!tx.to || !isSameAddress(tx.to, config.contractAddress)) {
      console.error('[ArbitrumVerification] TX to unexpected address:', tx.to, 'expected:', config.contractAddress);
      return false;
    }
    
    // 3. Check TX value is sufficient (if fee-based)
    if (BigInt(tx.value) < BigInt(config.minEntryFee)) {
      console.error('[ArbitrumVerification] TX value too low:', tx.value, 'required:', config.minEntryFee);
      return false;
    }
    
    // 4. Check TX has correct function call (registerForGame)
    if (!isValidRegisterFunctionCall(tx.input, userFid)) {
      console.error('[ArbitrumVerification] TX data does not match registerForGame(fid)');
      return false;
    }
    
    // Fetch receipt to confirm TX succeeded
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    
    if (!receipt) {
      console.warn('[ArbitrumVerification] TX receipt not available yet (pending or not yet mined):', txHash);
      // Don't fail here - TX might be pending. Let caller decide retry strategy.
      return true; // Optimistically accept
    }
    
    // 5. Check TX status (1 = success, 0 = reverted)
    const status = receipt.status as unknown as number;
    if (status !== 1) {
      console.error('[ArbitrumVerification] TX failed on-chain');
      return false;
    }
    
    console.log('[ArbitrumVerification] TX verified successfully:', txHash);
    return true;
  } catch (error) {
    console.error('[ArbitrumVerification] Verification error:', error);
    // Return false on any unexpected error (fail secure)
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
  // Function selector for registerForGame(uint256)
  const SELECTOR = '0x7c5de883';
  
  // Encode FID as 32-byte uint256
  const encodedFid = toHex(fid, { size: 32 });
  
  return (SELECTOR + encodedFid.slice(2)) as `0x${string}`;
}

/**
 * Verify TX input matches expected function call
 */
function isValidRegisterFunctionCall(input: string, expectedFid: number): boolean {
  try {
    const expected = encodeRegisterFunctionCall(expectedFid);
    // Case-insensitive comparison
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

// ========== TYPES FOR EXTERNAL USE ==========

export interface RegistrationTxState {
  status: 'idle' | 'pending' | 'confirming' | 'confirmed' | 'failed';
  txHash: string | null;
  error: string | null;
  walletAddress: string | null;
}
