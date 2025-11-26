// src/lib/walletConnection.ts
import { createConfig, http, injected } from 'wagmi';
import { mainnet, optimism, base } from 'wagmi/chains';
// Note: walletConnect import will be fixed when wagmi is properly configured
// import { walletConnect } from '@wagmi/connectors';
import { isFarcasterMiniApp } from './farcasterAuth';

// Wallet connection configuration
export const walletConfig = createConfig({
  chains: [mainnet, optimism, base], // Farcaster is on OP/Base
  connectors: [
    injected(),
    // walletConnect will be added when properly configured
    // walletConnect({
    //   projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    // }),
  ],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
});

// Farcaster profile fetching
export async function fetchFarcasterProfile(address: string): Promise<{
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
} | null> {
  try {
    // Use Neynar API to fetch profile by connected address
    const response = await fetch('/api/profiles/by-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      throw new Error('Profile not found');
    }

    const data = await response.json();
    return {
      fid: data.fid,
      username: data.username,
      displayName: data.display_name,
      pfpUrl: data.pfp_url,
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