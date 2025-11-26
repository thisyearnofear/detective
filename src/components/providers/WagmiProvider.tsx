'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { walletConfig } from '@/lib/walletConnection';
import { useState } from 'react';

type Props = {
  children: React.ReactNode;
};

export default function WagmiProviderWrapper({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}