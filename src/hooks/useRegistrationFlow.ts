'use client';

import { useState, useCallback } from 'react';
import { RegistrationStep } from '@/components/ArbitrumRegistrationModal';

// Type for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}

interface UseRegistrationFlowReturn {
  currentStep: RegistrationStep;
  error: string | null;
  walletConnected: boolean;
  executeRegistration: (onBeforeWallet: () => void) => Promise<string | null>;
  reset: () => void;
}

/**
 * Hook to manage Arbitrum registration flow with proper step progression
 * 
 * Tracks: wallet connection → signing → confirming → success/error
 * Orchestrates the async progression of requestArbitrumRegistrationTx
 */
export function useRegistrationFlow(): UseRegistrationFlowReturn {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setError(null);
    setWalletConnected(false);
  }, []);

  const executeRegistration = useCallback(
    async (onBeforeWallet: () => void): Promise<string | null> => {
      setCurrentStep('idle');
      setError(null);

      try {
        // Call parent's pre-wallet hook (set loading, etc)
        onBeforeWallet();

        // Step 1: Request wallet connection
        setCurrentStep('wallet-check');
        
        if (!window.ethereum) {
          throw new Error('MetaMask or Arbitrum-compatible wallet not found. Please install MetaMask.');
        }

        // Detect wallet connection (this will show MetaMask popup)
        const accounts = (await window.ethereum.request({
          method: 'eth_requestAccounts',
        })) as string[];

        if (!accounts || accounts.length === 0) {
          throw new Error('No wallet accounts available. Please connect your wallet.');
        }

        setWalletConnected(true);
        const userAddress = accounts[0];
        console.log('[useRegistrationFlow] Wallet connected:', userAddress);

        // Step 2: Sign transaction
        setCurrentStep('signing');

        // Switch to Arbitrum network
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa4b1' }], // Arbitrum mainnet
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            const config = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0xa4b1',
                  chainName: 'Arbitrum One',
                  rpcUrls: [config],
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

        // Import verification module to get config and send TX
        const { getArbitrumConfig } = await import('@/lib/arbitrumVerification');
        const config = getArbitrumConfig();

        // Encode and send the registration TX
        const txHash = await sendRegistrationTx(userAddress, config);

        if (!txHash) {
          throw new Error('Failed to get transaction hash from wallet');
        }

        // Store wallet for later verification
        if (typeof window !== 'undefined') {
          localStorage.setItem('arbitrumWalletAddress', userAddress);
        }

        console.log('[useRegistrationFlow] TX signed:', txHash);

        // Step 3: Confirm on-chain
        setCurrentStep('confirming');

        // Poll for TX confirmation (with timeout)
        const confirmed = await waitForConfirmation(txHash, 30000); // 30s timeout
        
        if (!confirmed) {
          throw new Error('Transaction confirmation timeout. Please check your wallet.');
        }

        // Success
        setCurrentStep('success');
        return txHash;
      } catch (err: any) {
        console.error('[useRegistrationFlow] Registration error:', err);
        
        // Handle specific wallet rejection
        if (err.code === 4001) {
          setError('You rejected the transaction. Please try again if you want to register.');
        } else if (err.code === -32002) {
          setError('MetaMask is already processing a request. Please check your wallet.');
        } else {
          setError(err.message || 'Registration failed. Please try again.');
        }
        
        setCurrentStep('error');
        return null;
      }
    },
    []
  );

  return {
    currentStep,
    error,
    walletConnected,
    executeRegistration,
    reset,
  };
}

/**
 * Helper: Encode registerForGame function call
 */
function encodeRegisterFunctionCall(fid: number): string {
  const SELECTOR = '0x7c5de883';
  const encodedFid = fid.toString(16).padStart(64, '0');
  return SELECTOR + encodedFid;
}

/**
 * Helper: Send registration TX to contract
 */
async function sendRegistrationTx(userAddress: string, config: any): Promise<string> {
  const fid = parseInt(localStorage.getItem('userFid') || '0', 10);
  
  console.log('[useRegistrationFlow] Encoding FID:', fid);
  
  const encodedData = encodeRegisterFunctionCall(fid);
  console.log('[useRegistrationFlow] Encoded data:', encodedData);
  
  const params = [
    {
      from: userAddress,
      to: config.contractAddress,
      value: '0x0', // No fee required
      data: encodedData,
      gas: '0x186a0',
    },
  ];

  console.log('[useRegistrationFlow] Sending TX to contract:', config.contractAddress);
  console.log('[useRegistrationFlow] TX params:', JSON.stringify(params[0], null, 2));

  const txHash = (await window.ethereum!.request({
    method: 'eth_sendTransaction',
    params,
  })) as string;

  if (!txHash || typeof txHash !== 'string') {
    throw new Error('Invalid TX hash returned from wallet');
  }

  return txHash;
}

/**
 * Helper: Wait for TX confirmation with timeout
 */
async function waitForConfirmation(txHash: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2s

  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await window.ethereum!.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }) as any;

      if (receipt && receipt.status !== null) {
        // TX is mined
        if (receipt.status === '0x1') {
          console.log('[useRegistrationFlow] TX confirmed on-chain');
          return true;
        } else {
          throw new Error('Transaction failed on-chain');
        }
      }

      // Not yet confirmed, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (err) {
      console.error('[useRegistrationFlow] Confirmation error:', err);
      throw err;
    }
  }

  // Timeout
  return false;
}
