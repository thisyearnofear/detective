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
  executeRegistration: (
    onBeforeWallet: () => void, 
    options?: { skipPermissions?: boolean }
  ) => Promise<{ txHash: string; permissions?: { hasPermission: boolean; expiry: number } } | null>;
  reset: () => void;
}

/**
 * Hook to manage Arbitrum registration flow with proper step progression
 * 
 * Tracks: wallet connection → signing → confirming → request-permissions → success/error
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
    async (
      onBeforeWallet: () => void, 
      options?: { skipPermissions?: boolean }
    ): Promise<{ txHash: string; permissions?: { hasPermission: boolean; expiry: number } } | null> => {
      setCurrentStep('idle');
      setError(null);

      try {
        // ... (existing wallet and TX logic)
        onBeforeWallet();
        setCurrentStep('wallet-check');
        const { requestAccounts, switchChain, addChain, sendTransaction, resetProvider, requestPermissions } = await import('@/lib/farcasterWalletProvider');
        resetProvider();
        const accounts = await requestAccounts();

        if (!accounts || accounts.length === 0) {
          throw new Error('No wallet accounts available. Please connect your wallet.');
        }

        setWalletConnected(true);
        const userAddress = accounts[0];
        console.log('[useRegistrationFlow] Wallet connected:', userAddress);

        setCurrentStep('signing');
        try {
          await switchChain('0xa4b1'); // Arbitrum mainnet
        } catch (switchError: any) {
          // ... (existing switchChain logic)
          if (switchError.message?.includes('not found')) {
            const rpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
            await addChain({
              chainId: '0xa4b1',
              chainName: 'Arbitrum One',
              rpcUrls: [rpcUrl],
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

        const fid = parseInt(localStorage.getItem('userFid') || '0', 10);
        if (fid <= 0) {
          throw new Error('User FID not found');
        }

        const { getArbitrumConfig, encodeRegisterFunctionCall } = await import('@/lib/arbitrumVerification');
        const config = getArbitrumConfig();
        const encodedData = encodeRegisterFunctionCall(fid);
        const txHash = await sendTransaction({
          from: userAddress,
          to: config.contractAddress,
          value: '0x0',
          data: encodedData,
          gas: '0x186a0',
        });

        if (!txHash) {
          throw new Error('Failed to get transaction hash from wallet');
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('arbitrumWalletAddress', userAddress);
        }

        setCurrentStep('confirming');
        const { isFarcasterMiniApp } = await import('@/lib/farcasterAuth');
        if (!isFarcasterMiniApp()) {
          const confirmed = await waitForConfirmation(txHash, 30000);
          if (!confirmed) throw new Error('Transaction confirmation timeout');
        }

        // STEP: Request Session Permissions (ERC-7715)
        let permissionsInfo = undefined;
        if (!options?.skipPermissions) {
          setCurrentStep('request-permissions');
          try {
            const { formatGamePermissionRequest, SESSION_DURATION_SECONDS } = await import('@/lib/erc7715');
            const permissionReq = formatGamePermissionRequest(config.contractAddress as `0x${string}`);
            
            const granted = await requestPermissions([permissionReq]);
            
            if (granted) {
              console.log('[useRegistrationFlow] Session permissions granted');
              permissionsInfo = {
                hasPermission: true,
                expiry: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
              };
            }
          } catch (permError: any) {
            console.warn('[useRegistrationFlow] Permission request skipped or failed:', permError.message);
            // Don't fail the whole registration if permissions are skipped, 
            // just continue without the "Zero-Click" feature.
          }
        }

        setCurrentStep('success');
        return { txHash, permissions: permissionsInfo };
      } catch (err: any) {
        // ... (existing error handling)
        console.error('[useRegistrationFlow] Registration error:', err);
        if (err.message?.includes('rejected')) {
          setError('Transaction rejected. Try again if you want to register.');
        } else if (err.message?.includes('not found')) {
          setError(err.message);
        } else if (err.code === -32002) {
          setError('Wallet is busy. Try again.');
        } else {
          setError(err.message || 'Registration failed');
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
 * Helper: Wait for TX confirmation with timeout
 * Uses Farcaster-aware wallet provider for both contexts
 */
async function waitForConfirmation(txHash: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2s
  const { getTransactionReceipt } = await import('@/lib/farcasterWalletProvider');

  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await getTransactionReceipt(txHash);

      if (receipt && receipt.status !== null) {
        // TX is mined
        if (receipt.status === '0x1') {
          console.log('[useRegistrationFlow] TX confirmed on-chain');
          return true;
        } else {
          throw new Error('Transaction failed');
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
