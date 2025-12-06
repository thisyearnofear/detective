'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import SpinningDetective from './SpinningDetective';

type Props = {
    onAuthSuccess: (userProfile: {
        fid: number;
        username: string;
        displayName: string;
        pfpUrl: string;
        token: string;
    }) => void;
};

export default function AuthInput({ onAuthSuccess }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();

    // Fetch profile when wallet connects
    useEffect(() => {
        if (isConnected && address) {
            fetchProfile(address);
        }
    }, [isConnected, address]);

    const fetchProfile = async (walletAddress: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/profiles/by-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: walletAddress }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to verify wallet and profile');
            }

            if (data.success && data.profile && data.token) {
                // Store token in localStorage for subsequent API requests
                localStorage.setItem('auth-token', data.token);
                
                onAuthSuccess({
                    ...data.profile,
                    token: data.token,
                });
            } else {
                throw new Error('No Farcaster profile associated with this wallet');
            }
        } catch (err: any) {
            console.error('Profile fetch error:', err);
            setError(err.message || 'Failed to fetch Farcaster profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-3">
                <h3 className="text-xl font-black text-white tracking-tight">Join the Game</h3>
                <p className="text-sm text-gray-300 font-medium">
                    Connect your wallet to verify your Farcaster profile
                </p>
            </div>

            {error && (
                <div className="bg-red-500/15 border-2 border-red-500/30 rounded-xl p-4 text-red-200 text-sm text-center backdrop-blur-sm animate-fade-in font-medium">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <SpinningDetective size="lg" />
                </div>
            ) : (
                <div className="space-y-3">
                    {connectors.map((connector) => (
                        <button
                            key={connector.id}
                            onClick={() => connect({ connector })}
                            disabled={isLoading}
                            className="w-full bg-white/8 hover:bg-white/12 border-2 border-white/15 hover:border-white/25 rounded-xl px-5 py-4 text-white font-bold transition-all duration-300 backdrop-blur-sm"
                        >
                            {connector.name}
                        </button>
                    ))}
                </div>
            )}

            <div className="pt-4 border-t border-white/10 text-center space-y-2">
                <p className="text-xs text-gray-400 font-medium">
                    Using Farcaster app? <a href="warpcast://detective" className="text-blue-400 hover:text-blue-300 transition-colors font-semibold">Open there</a>
                </p>
                <p className="text-xs text-gray-500">
                    Your wallet must be connected to your Farcaster account
                </p>
            </div>
        </div>
    );
}
