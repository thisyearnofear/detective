'use client';

/**
 * Unified Authentication Component (December 2025)
 * 
 * Smart routing based on context:
 * - MiniApp: Auto-connects via Quick Auth
 * - Web: Shows @farcaster/auth-kit SignInButton (handles button + QR UI)
 * 
 * Both converge at single server verification endpoint.
 */

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { SignInButton } from '@farcaster/auth-kit';
import SpinningDetective from './SpinningDetective';

export type AuthUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

type Props = {
  onAuthSuccess: (user: AuthUser, token: string) => void;
  onError?: (error: string) => void;
};

type VerifyResponse = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

export default function UnifiedAuthComponent({
  onAuthSuccess,
  onError,
}: Props) {
  const [step, setStep] = useState<'detecting' | 'authenticating' | 'webauth' | 'error'>('detecting');
  const [error, setError] = useState<string | null>(null);

  /**
   * Unified server verification for both MiniApp and Web flows
   * DRY: Single source of truth for token validation
   */
  const verifyTokenOnServer = async (token: string): Promise<VerifyResponse> => {
    const response = await fetch('/api/auth/quick-auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to verify authentication');
    }

    return response.json();
  };

  /**
   * Handle successful authentication from either source
   * DRY: Single path for all auth success cases
   */
  const handleAuthSuccess = async (token: string) => {
    try {
      // Verify token on server
      const userData = await verifyTokenOnServer(token);

      // Store token for subsequent API requests
      localStorage.setItem('auth-token', token);

      // Notify parent component
      onAuthSuccess(
        {
          fid: userData.fid,
          username: userData.username,
          displayName: userData.displayName,
          pfpUrl: userData.pfpUrl,
        },
        token
      );

      // Signal ready to Farcaster (if in MiniApp context)
      try {
        await sdk.actions.ready();
      } catch {
        // Not critical - will fail if not in MiniApp context
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setStep('error');
      onError?.(errorMessage);
    }
  };

  /**
   * MiniApp Quick Auth flow
   * Only runs on initial mount; detects context and either authenticates or shows web UI
   */
  useEffect(() => {
    const detectContextAndAuth = async () => {
      try {
        setError(null);

        // Try Quick Auth (only available in MiniApp)
        let token: string | null = null;
        let inMiniApp = false;

        try {
          setStep('authenticating');
          const result = await Promise.race([
            sdk.quickAuth.getToken(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('timeout')), 2000)
            )
          ]);
          
          const quickAuthResult = result as { token?: string };
          token = quickAuthResult?.token || null;
          inMiniApp = !!token;
        } catch {
          // Not in MiniApp - show web auth instead
          inMiniApp = false;
        }

        // If not in MiniApp, show web auth UI
        if (!inMiniApp) {
          setStep('webauth');
          return;
        }

        if (!token) {
          throw new Error('Failed to get authentication token');
        }

        // Got token - proceed to verification
        await handleAuthSuccess(token);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        setStep('error');
        onError?.(errorMessage);
      }
    };

    detectContextAndAuth();
  }, [onAuthSuccess, onError]);

  // Detecting MiniApp context
  if (step === 'detecting') {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <SpinningDetective />
        <div className="text-center space-y-2">
          <p className="text-white font-semibold">Loading...</p>
          <p className="text-sm text-gray-400">Checking Farcaster context</p>
        </div>
      </div>
    );
  }

  // MiniApp authenticating via Quick Auth
  if (step === 'authenticating') {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <SpinningDetective />
        <div className="text-center space-y-2">
          <p className="text-white font-semibold">Signing you in...</p>
          <p className="text-sm text-gray-400">Approve in Farcaster</p>
        </div>
      </div>
    );
  }

  // Web: Show native SignInButton from @farcaster/auth-kit
  // This component handles the button + QR code UI automatically
  if (step === 'webauth') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">📱</div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Sign in with Farcaster</h3>
            <p className="text-sm text-gray-300">
              Connect your Farcaster account using the button below
            </p>
          </div>
        </div>

        {/* Native SignInButton from @farcaster/auth-kit */}
        {/* This handles:
            - Button UI
            - QR code display
            - Deep link for mobile
            - Polling for signature completion
        */}
        <div className="flex justify-center">
          <SignInButton
            timeout={300_000}
            interval={1500}
            onSuccess={async (res) => {
              try {
                // res contains the SIWF signature and user profile data
                if (!res.signature || !res.message) {
                  throw new Error('Invalid sign-in response');
                }

                // Create a temporary token from the signature
                // Server endpoint will verify this and extract FID
                const tempToken = btoa(
                  JSON.stringify({
                    message: res.message,
                    signature: res.signature,
                  })
                );

                // Call unified auth handler
                await handleAuthSuccess(tempToken);
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Sign-in failed';
                setError(errorMsg);
                onError?.(errorMsg);
              }
            }}
            onError={(err) => {
              const errorMsg = err?.message || 'Sign-in failed';
              setError(errorMsg);
              onError?.(errorMsg);
            }}
            hideSignOut={true}
          />
        </div>

        <p className="text-xs text-gray-400 text-center">
          Don't have Farcaster? Download the app or visit farcaster.xyz
        </p>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="space-y-6">
        <div className="bg-red-500/15 border-2 border-red-500/30 rounded-xl p-4 text-red-200 text-sm text-center">
          <p className="font-semibold mb-2">Authentication Error</p>
          <p>{error}</p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
}
