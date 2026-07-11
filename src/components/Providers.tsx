'use client';

import { useEffect, useState } from 'react';
import { AuthKitProvider } from '@farcaster/auth-kit';
import { sdk } from '@farcaster/miniapp-sdk';
import { isFarcasterMiniApp } from '@/lib/farcasterAuth';

function MiniAppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initMiniApp = async () => {
      try {
        if (typeof window !== 'undefined' && sdk) {
          await sdk.actions.ready();
          console.log('[MiniApp] SDK initialized and ready');
        }
      } catch {
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
    setIsMiniApp(isFarcasterMiniApp());
  }, []);

  // In miniapp: skip AuthKitProvider (uses miniapp SDK auth instead)
  // In browser: use AuthKitProvider for Farcaster Auth Kit
  if (isMiniApp) {
    return <MiniAppInitializer>{children}</MiniAppInitializer>;
  }

  return (
    <AuthKitProvider config={{ relay: 'https://relay.farcaster.xyz' }}>
      <MiniAppInitializer>{children}</MiniAppInitializer>
    </AuthKitProvider>
  );
}
