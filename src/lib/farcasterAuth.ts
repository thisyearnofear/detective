// src/lib/farcasterAuth.ts
// Import the modern Farcaster MiniApp SDK (2025 standard)
import { sdk } from '@farcaster/miniapp-sdk';

// Export the SDK for use throughout the app
export const miniApp = sdk;

export type FarcasterUser = {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
};

// Check if we're running in a Farcaster context
export function isFarcasterMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  return !!(
    // Check for Farcaster-specific globals
    window.parent !== window ||
    (window as any).farcasterClient ||
    // Check for Warpcast user agent
    navigator.userAgent.includes('Farcaster') ||
    navigator.userAgent.includes('Warpcast') ||
    // Check URL parameters that indicate Farcaster context
    window.location.href.includes('warpcast.com') ||
    window.location.search.includes('fc_') ||
    // Check for iframe context with Farcaster origins
    document.referrer.includes('warpcast.com') ||
    document.referrer.includes('farcaster.xyz')
  );
}

// Authenticate with Farcaster SDK
export async function authenticateWithFarcaster(): Promise<FarcasterUser> {
  try {
    console.log('[FarcasterAuth] Starting authentication...');
    
    // Get user context from Farcaster (context is a Promise, not callable)
    const context = await miniApp.context;
    console.log('[FarcasterAuth] Context received:', context);
    
    if (!context?.user) {
      throw new Error('No user found in Farcaster context');
    }
    
    const user = context.user;
    
    // Transform Farcaster user to our format
    const farcasterUser: FarcasterUser = {
      fid: user.fid,
      username: user.username || '',
      displayName: user.displayName || '',
      pfpUrl: user.pfpUrl || '',
    };
    
    console.log('[FarcasterAuth] Authentication successful:', farcasterUser);
    return farcasterUser;
    
  } catch (error) {
    console.error('[FarcasterAuth] Authentication failed:', error);
    throw new Error(`Farcaster authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Request notification permissions (for game updates)
// Note: The modern Farcaster SDK doesn't provide an explicit notification permission API
// Notifications are enabled through the miniapp manifest configuration
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!isFarcasterMiniApp()) return false;
    console.log('[FarcasterAuth] Notifications configured via manifest');
    return true;
  } catch (error) {
    console.error('[FarcasterAuth] Notification setup failed:', error);
    return false;
  }
}

// Send notification when game starts
// Note: Notifications are triggered via webhook/server-side in the modern SDK
export async function sendGameStartNotification(message: string): Promise<void> {
  try {
    if (!isFarcasterMiniApp()) return;
    console.log('[FarcasterAuth] Game notification:', message);
    // In production, this would trigger a server-side webhook to send the notification
  } catch (error) {
    console.error('[FarcasterAuth] Failed to trigger notification:', error);
  }
}

// Open external URL (for sharing, etc.)
export async function openExternalUrl(url: string): Promise<void> {
  try {
    if (!isFarcasterMiniApp()) {
      window.open(url, '_blank');
      return;
    }
    
    await miniApp.actions.openUrl(url);
  } catch (error) {
    console.error('[FarcasterAuth] Failed to open URL:', error);
    // Fallback to regular window.open
    window.open(url, '_blank');
  }
}

// Get Farcaster app info
export async function getFarcasterAppInfo(): Promise<any> {
  try {
    if (!isFarcasterMiniApp()) return null;
    
    const context = await miniApp.context;
    return {
      client: context?.client,
      location: context?.location,
    };
  } catch (error) {
    console.error('[FarcasterAuth] Failed to get app info:', error);
    return null;
  }
}