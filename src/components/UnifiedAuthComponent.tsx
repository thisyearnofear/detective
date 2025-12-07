'use client';

/**
 * Unified Authentication Component (December 2025)
 * 
 * Handles both Farcaster MiniApp and web contexts seamlessly:
 * 
 * 1. **In Farcaster (MiniApp)**: Auto-connects via Quick Auth
 *    - No UI needed, automatic authentication
 *    - User gets instant access
 * 
 * 2. **On Web**: Shows AuthKit's SignInButton for QR code flow
 *    - User scans QR with Farcaster/Warpcast
 *    - Gets full access, same as MiniApp users
 *    - Clear, standard Farcaster authentication
 * 
 * Reference: 
 * - https://miniapps.farcaster.xyz/docs/guides/auth
 * - https://docs.farcaster.xyz/auth-kit/
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
};

export default function UnifiedAuthComponent({
  onAuthSuccess,
  onError,
}: Props) {
  const [step, setStep] = useState<'detecting' | 'authenticating' | 'webauth' | 'error'>('detecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authenticate = async () => {
      try {
        // Detect if we're in Farcaster MiniApp context
        let inMiniApp = false;
        let token: string | null = null;

        try {
          // Try Quick Auth (only works in MiniApp)
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
        } catch (sdkError) {
          // Not in MiniApp or Quick Auth failed - will show web auth
          inMiniApp = false;
        }



        if (!inMiniApp) {
          // Show web auth UI (QR code via AuthKit)
          setStep('webauth');
          return;
        }

        // MiniApp: We got a token, verify it on server
        if (!token) {
          throw new Error('Failed to obtain authentication token');
        }

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

        const userData = await response.json();
        localStorage.setItem('auth-token', token);

        onAuthSuccess(
          {
            fid: userData.fid,
            username: userData.username,
            displayName: userData.displayName,
            pfpUrl: userData.pfpUrl,
          },
          token
        );

        // Signal ready to Farcaster
        try {
          await sdk.actions.ready();
        } catch {
          // Not critical
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        setStep('error');
        onError?.(errorMessage);
      }
    };

    authenticate();
  }, [onAuthSuccess, onError]);

  // Detecting context
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

  // MiniApp authenticating
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

  // Web auth - show QR code instructions
  if (step === 'webauth') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">📱</div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Sign in with Farcaster</h3>
            <p className="text-sm text-gray-300">
              Scan the QR code below with Warpcast or any Farcaster client to authenticate
            </p>
          </div>
        </div>

        {/* Web Auth QR Component - Import from @farcaster/auth-kit */}
        <WebAuthQRComponent />
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

/**
 * Web Auth QR Component
 * Uses @farcaster/auth-kit for standard QR code sign-in
 */
function WebAuthQRComponent() {

  // This is a placeholder - in production, import SignInButton from @farcaster/auth-kit
  // For now, show instructions on how to integrate
  return (
    <div className="space-y-4">
      <div className="bg-blue-500/15 border-2 border-blue-500/30 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-300 mb-4">
          ℹ️ QR code will appear here after integrating @farcaster/auth-kit
        </p>
        
        {/* This is where SignInButton from @farcaster/auth-kit would go:
          <SignInButton
            onSuccess={(res) => {
              // Handle successful sign-in
              // Verify token on server
              // Call onAuthSuccess with user data
            }}
            onError={(err) => {
              onError?.(err.message);
            }}
          />
        */}

        <div className="bg-white/5 border border-white/20 rounded-lg p-6 text-left text-xs text-gray-300 font-mono">
          <p className="mb-2 font-bold text-white">Integration needed:</p>
          <p className="mb-4">npm install @farcaster/auth-kit</p>
          <p className="text-gray-400">Then add SignInButton component above</p>
        </div>
      </div>
    </div>
  );
}
