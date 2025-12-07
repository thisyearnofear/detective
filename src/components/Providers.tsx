'use client';

import { AuthKitProvider } from '@farcaster/auth-kit';
import { ModalProvider } from '@/components/ModalStack';

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthKitProvider config={{ relay: 'https://relay.farcaster.xyz' }}>
      <ModalProvider>{children}</ModalProvider>
    </AuthKitProvider>
  );
}
