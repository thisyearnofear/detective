'use client';

import { useEffect, useState } from 'react';
import { AuthKitProvider } from '@farcaster/auth-kit';
import { ModalProvider } from '@/components/ModalStack';
import { sdk } from '@farcaster/miniapp-sdk';
import { isFarcasterMiniApp } from '@/lib/farcasterAuth';

function MiniAppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize mini app - signal that app is ready to display
    // This hides the splash screen and shows content
    const initMiniApp = async () => {
      try {
        // Only call ready if we're in a mini app environment
        if (typeof window !== 'undefined' && sdk) {
          await sdk.actions.ready();
          console.log('[MiniApp] SDK initialized and ready');
        }
      } catch (error) {
        // SDK might not be available in non-mini app environment
        console.debug('[MiniApp] SDK not available (expected in browser)');
      }
    };

    initMiniApp();
  }, []);

  return <>{children}</>;
}

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState(false);
  
  useEffect(() => {
    // Check if we're in a miniapp context on mount
    setIsMiniApp(isFarcasterMiniApp());
  }, []);
  
  // In miniapp: skip AuthKitProvider (uses miniapp SDK auth instead)
  // In browser: use AuthKitProvider for Farcaster Auth Kit
  if (isMiniApp) {
    return (
      <ModalProvider>
        <MiniAppInitializer>
          {children}
        </MiniAppInitializer>
      </ModalProvider>
    );
  }
  
  return (
    <AuthKitProvider config={{ relay: 'https://relay.farcaster.xyz' }}>
      <ModalProvider>
        <MiniAppInitializer>
          {children}
        </MiniAppInitializer>
      </ModalProvider>
    </AuthKitProvider>
  );
}
