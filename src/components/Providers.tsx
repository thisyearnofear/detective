'use client';

import { useEffect } from 'react';
import { AuthKitProvider } from '@farcaster/auth-kit';
import { ModalProvider } from '@/components/ModalStack';
import { sdk } from '@farcaster/miniapp-sdk';

function MiniAppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize mini app - signal that app is ready to display
    // This hides the splash screen and shows content
    const initMiniApp = async () => {
      try {
        // Only call ready if we're in a mini app environment
        if (typeof window !== 'undefined' && sdk) {
          await sdk.actions.ready();
        }
      } catch (error) {
        // SDK might not be available in non-mini app environment
        console.debug('Mini app SDK not available');
      }
    };

    initMiniApp();
  }, []);

  return <>{children}</>;
}

export function RootProviders({ children }: { children: React.ReactNode }) {
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
