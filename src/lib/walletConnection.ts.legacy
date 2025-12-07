// src/lib/walletConnection.ts
import { createConfig, http, injected } from 'wagmi';
import { mainnet, optimism, base, sepolia } from 'wagmi/chains';
import { walletConnect } from '@wagmi/connectors';
import { isFarcasterMiniApp } from './farcasterAuth';

// WalletConnect Project ID (for mobile wallet connections)
// Set this in environment variables for production
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Wallet connection configuration - supports MetaMask, WalletConnect, and more
export const walletConfig = createConfig({
  chains: [mainnet, optimism, base, sepolia],
  connectors: [
    injected(), // MetaMask and other injected wallets
    ...(WALLETCONNECT_PROJECT_ID 
      ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })]
      : []
    ),
  ],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
});

/**
 * Fetch Farcaster profile and auth token by connected wallet address
 * Returns both profile data and JWT token for authenticated API requests
 * 
 * Note: This is the legacy method. Prefer the Sign In with Farcaster flow
 * in FarcasterAuthKit component which uses cryptographic verification.
 */
export async function fetchFarcasterProfile(address: string): Promise<{
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  token: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch('/api/profiles/by-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Profile lookup failed');
    }

    const data = await response.json();
    return {
      fid: data.profile.fid,
      username: data.profile.username,
      displayName: data.profile.displayName,
      pfpUrl: data.profile.pfpUrl,
      token: data.token,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    console.error('Failed to fetch Farcaster profile:', error);
    return null;
  }
}

// Detect if running in Farcaster frame/app
export function isFarcasterApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  return !!(
    window.parent !== window || // Running in iframe
    navigator.userAgent.includes('Farcaster') ||
    navigator.userAgent.includes('Warpcast') ||
    window.location.href.includes('warpcast.com') ||
    window.location.search.includes('fc_') ||
    document.referrer.includes('warpcast.com') ||
    document.referrer.includes('farcaster.xyz')
  );
}

// Platform-specific connection strategies
export type WalletPlatform = 'farcaster' | 'web' | 'mobile';

export function detectPlatform(): WalletPlatform {
  if (typeof window === 'undefined') return 'web';
  
  // Check for actual Farcaster miniapp context first
  if (isFarcasterMiniApp() || isFarcasterApp()) return 'farcaster';
  
  // Check if mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  return isMobile ? 'mobile' : 'web';
}
