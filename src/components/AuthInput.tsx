'use client';

import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import SpinningDetective from './SpinningDetective';
import WalletConnectModal from './WalletConnectModal';
import FarcasterSetupModal from './FarcasterSetupModal';

type Props = {
    onAuthSuccess: (userProfile: {
        fid: number;
        username: string;
        displayName: string;
        pfpUrl: string;
        token: string;
    }) => void;
};

type AuthStep = 'connect' | 'verifying' | 'setup-farcaster';

export default function AuthInput({ onAuthSuccess }: Props) {
    const [authStep, setAuthStep] = useState<AuthStep>('connect');
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [isFarcasterModalOpen, setIsFarcasterModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();

    // Handle wallet connection and Farcaster verification
    useEffect(() => {
        if (isConnected && address && authStep === 'connect') {
            setAuthStep('verifying');
            fetchProfile(address);
        }
    }, [isConnected, address, authStep]);

    const fetchProfile = async (walletAddress: string) => {
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
                throw new Error('No Farcaster profile found');
            }
        } catch (err: any) {
            console.error('Profile fetch error:', err);
            setError(err.message || 'Failed to fetch Farcaster profile');
            
            // Show Farcaster setup modal if no profile found
            if (err.message.includes('No valid Farcaster profile found') || 
                err.message.includes('No Farcaster profile found')) {
                setAuthStep('setup-farcaster');
                setIsFarcasterModalOpen(true);
            } else {
                // Other errors - reset to connect step
                setAuthStep('connect');
                disconnect();
            }
        }
    };

    const handleConnectClick = () => {
        setIsWalletModalOpen(true);
        setError(null);
    };

    const handleWalletConnected = () => {
        setIsWalletModalOpen(false);
        // The useEffect will handle the next step
    };

    const handleFarcasterModalClose = () => {
        setIsFarcasterModalOpen(false);
        setAuthStep('connect');
        disconnect(); // Disconnect wallet to start fresh
    };

    const handleRetryVerification = () => {
        if (address) {
            setAuthStep('verifying');
            fetchProfile(address);
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="text-center space-y-3">
                    <h3 className="text-xl font-black text-white tracking-tight">Join the Game</h3>
                    <p className="text-sm text-gray-300 font-medium">
                        {authStep === 'verifying' 
                            ? 'Verifying your Farcaster profile...'
                            : 'Connect your wallet to verify your Farcaster profile'
                        }
                    </p>
                </div>

                {error && authStep !== 'setup-farcaster' && (
                    <div className="bg-red-500/15 border-2 border-red-500/30 rounded-xl p-4 text-red-200 text-sm text-center backdrop-blur-sm animate-fade-in font-medium">
                        {error}
                        {address && (
                            <button 
                                onClick={handleRetryVerification}
                                className="block w-full mt-3 text-blue-300 hover:text-blue-200 font-semibold transition-colors"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                )}

                {authStep === 'verifying' ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center space-y-3">
                            <SpinningDetective size="lg" />
                            <p className="text-sm text-gray-400">Checking Farcaster profile...</p>
                            {address && (
                                <p className="text-xs text-gray-500 font-mono break-all">
                                    {address.slice(0, 6)}...{address.slice(-4)}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={handleConnectClick}
                            disabled={isConnected}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-2 border-purple-500/50 hover:border-purple-400/70 rounded-xl px-6 py-4 text-white font-bold transition-all duration-300 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <span className="text-xl">🔗</span>
                            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
                        </button>
                        
                        {isConnected && address && authStep === 'connect' && (
                            <div className="bg-green-500/15 border-2 border-green-500/30 rounded-xl p-3 text-green-200 text-sm text-center">
                                <p className="font-semibold">Wallet Connected</p>
                                <p className="text-xs font-mono mt-1">{address.slice(0, 6)}...{address.slice(-4)}</p>
                            </div>
                        )}
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

            <WalletConnectModal
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
                onWalletConnected={handleWalletConnected}
            />

            <FarcasterSetupModal
                isOpen={isFarcasterModalOpen}
                onClose={handleFarcasterModalClose}
                walletAddress={address || ''}
            />
        </>
    );
}
