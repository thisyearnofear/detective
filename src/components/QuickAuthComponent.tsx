'use client';

/**
 * Quick Auth Component (2025 Recommended)
 * 
 * Uses @farcaster/miniapp-sdk.quickAuth for seamless Farcaster authentication
 * This is the modern, official approach that handles all the complexity for you
 * 
 * Features:
 * - Automatic session token generation
 * - Works in Farcaster MiniApps context automatically
 * - Fallback for web users with QR code
 * 
 * Reference: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
 */

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
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

export default function QuickAuthComponent({
  onAuthSuccess,
  onError,
  onExploreWithoutAuth,
}: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'authenticating' | 'error'>('loading');

  useEffect(() => {
    const authenticate = async () => {
      try {
        setStep('authenticating');
        setError(null);

        // Get Quick Auth token (handles both MiniApp and web contexts)
        const { token } = await sdk.quickAuth.getToken();

        if (!token) {
          throw new Error('Failed to obtain authentication token');
        }

        // Verify token on your server
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
          throw new Error(
            errorData.error || 'Failed to verify authentication'
          );
        }

        const userData = await response.json();

        // Store token in localStorage for API requests
        localStorage.setItem('auth-token', token);

        // Notify parent
        onAuthSuccess(
          {
            fid: userData.fid,
            username: userData.username,
            displayName: userData.displayName,
            pfpUrl: userData.pfpUrl,
          },
          token
        );

        // Signal to Farcaster that we're ready (if in MiniApp context)
        try {
          await sdk.actions.ready();
        } catch {
          // Not in Farcaster context, that's fine
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        setStep('error');
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    authenticate();
  }, [onAuthSuccess, onError]);

  // Loading state
  if (isLoading || step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <SpinningDetective />
        <div className="text-center space-y-2">
          <p className="text-white font-semibold">Signing you in...</p>
          <p className="text-sm text-gray-400">
            Approve in your Farcaster client
          </p>
        </div>
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

  // Should not reach here, but just in case
  return null;
}
