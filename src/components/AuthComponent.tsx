'use client';

/**
 * Unified Authentication Component (December 2025)
 * 
 * Smart routing based on context:
 * - MiniApp: Auto-connects via Quick Auth SDK
 * - Web: Shows SignInButton with QR code flow
 * 
 * Both paths converge at single server verification endpoint.
 * Reference: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
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
  onExploreWithoutAuth?: () => void;
};

type VerifyResponse = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

type AuthStep = 'detecting' | 'authenticating' | 'webauth' | 'error';

export default function AuthComponent({
  onAuthSuccess,
  onError,
  onExploreWithoutAuth,
}: Props) {
  const [step, setStep] = useState<AuthStep>('detecting');
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
   * Handle successful authentication from either MiniApp or Web source
   * DRY: Single path for all auth success cases
   */
  const handleAuthSuccess = async (token: string) => {
    try {
      setStep('authenticating');
      
      // Verify token on server
      const userData = await verifyTokenOnServer(token);

      // Store token and user data for session persistence
      localStorage.setItem('auth-token', token);
      localStorage.setItem('cached-user', JSON.stringify({
        fid: userData.fid,
        username: userData.username,
        displayName: userData.displayName,
        pfpUrl: userData.pfpUrl,
      }));

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
        // Not in MiniApp context - that's fine
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setStep('error');
      onError?.(errorMessage);
    }
  };

  /**
   * Detect context and initiate appropriate auth flow
   * Only runs on initial mount
   */
  useEffect(() => {
    const detectContextAndAuth = async () => {
      try {
        setError(null);
        let token: string | null = null;
        let inMiniApp = false;

          // Try Quick Auth (only available in MiniApp)
          try {
            // Check if we're likely in a miniapp context first
            const isPossiblyMiniApp = 
              typeof window !== 'undefined' && (
                window.parent !== window ||
                navigator.userAgent.includes('Farcaster') ||
                navigator.userAgent.includes('Warpcast') ||
                document.referrer.includes('warpcast.com') ||
                document.referrer.includes('farcaster.xyz')
              );
            
            if (!isPossiblyMiniApp) {
              // Skip Quick Auth entirely if we're clearly not in a miniapp
              inMiniApp = false;
            } else {
              const result = await Promise.race([
                sdk.quickAuth.getToken(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('timeout')), 2000)
                )
              ]);
              
              const quickAuthResult = result as { token?: string };
              token = quickAuthResult?.token || null;
              inMiniApp = !!token;
            }
          } catch (quickAuthErr) {
            // Not in MiniApp or SDK error - will show web auth
            // Suppress SDK internal errors (e.g., RpcResponse parsing failures)
            console.log('[AuthComponent] Quick Auth unavailable:', quickAuthErr instanceof Error ? quickAuthErr.message : 'SDK error');
            inMiniApp = false;
          }

        // If in MiniApp and got token, authenticate
        if (inMiniApp && token) {
          await handleAuthSuccess(token);
          return;
        }

        // Not in MiniApp - show web auth UI
        setStep('webauth');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        setStep('error');
        onError?.(errorMessage);
      }
    };

    detectContextAndAuth();
  }, [onAuthSuccess, onError]);

  // =========================================================================
  // RENDER: Detecting
  // =========================================================================
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

  // =========================================================================
  // RENDER: Authenticating (MiniApp Quick Auth)
  // =========================================================================
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

  // =========================================================================
  // RENDER: Web Auth (Browser QR Code Flow)
  // =========================================================================
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
        <div className="flex justify-center relative z-10">
          <SignInButton
            timeout={300_000}
            interval={1500}
            onSuccess={async (res) => {
              try {
                if (!res.signature || !res.message || !res.fid) {
                  throw new Error('Invalid sign-in response: missing signature, message, or FID');
                }

                // Create a temporary token from the signature and profile data
                // auth-kit has already verified the signature on client side
                const tempToken = btoa(
                  JSON.stringify({
                    fid: res.fid,
                    username: res.username,
                    displayName: res.displayName,
                    pfpUrl: res.pfpUrl,
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

        {onExploreWithoutAuth && (
          <button
            onClick={onExploreWithoutAuth}
            className="w-full bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
          >
            Continue Without Auth
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: Error State
  // =========================================================================
  if (step === 'error') {
    return (
      <div className="space-y-6">
        <div className="bg-red-500/15 border-2 border-red-500/30 rounded-xl p-4 text-red-200 text-sm text-center">
          <p className="font-semibold mb-2">Authentication Error</p>
          <p>{error}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
          >
            Try Again
          </button>
          {onExploreWithoutAuth && (
            <button
              onClick={onExploreWithoutAuth}
              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
            >
              Continue Without Auth
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
