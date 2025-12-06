'use client';

import { useState } from 'react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onExploreWithoutAuth: () => void;
    walletAddress: string;
};

export default function FarcasterSetupModal({ isOpen, onClose, onExploreWithoutAuth, walletAddress }: Props) {
    const [showQRConnection, setShowQRConnection] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-gray-900/95 border-2 border-white/20 rounded-2xl p-6 max-w-md w-full backdrop-blur-md">
                <div className="text-center space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="text-5xl">🎯</div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors text-xl"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="text-xl font-bold text-white">Farcaster Account Needed</h3>
                        <p className="text-sm text-gray-300">
                            To play Detective, you'll need a Farcaster account connected to your wallet.
                        </p>
                    </div>

                    <div className="bg-blue-500/15 border-2 border-blue-500/30 rounded-xl p-4 text-blue-200 text-sm">
                        <p className="font-semibold mb-2">Connected wallet:</p>
                        <p className="font-mono text-xs break-all bg-white/10 p-2 rounded">
                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </p>
                    </div>

                    {!showQRConnection ? (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <a
                                    href="https://farcaster.xyz/~/code/YKR2G8"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-2 border-purple-500/50 rounded-xl px-6 py-4 text-white font-bold transition-all duration-300"
                                >
                                    🚀 Create Farcaster Account
                                </a>
                                
                                <button
                                    onClick={() => setShowQRConnection(true)}
                                    className="w-full bg-green-600 hover:bg-green-700 border-2 border-green-500/50 rounded-xl px-6 py-4 text-white font-bold transition-all duration-300"
                                >
                                    📱 Connect via Mobile App
                                </button>
                            </div>
                            
                            <p className="text-xs text-gray-500">
                                Already have Farcaster? Use mobile connection or make sure your wallet is linked in profile settings.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl">
                                <div className="text-gray-800 font-semibold mb-2">Scan with Warpcast</div>
                                {/* QR Code placeholder - would generate actual QR with wallet address */}
                                <div className="w-32 h-32 mx-auto bg-black grid grid-cols-8 gap-px">
                                    {Array.from({ length: 64 }).map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`${Math.random() > 0.5 ? 'bg-black' : 'bg-white'} aspect-square`} 
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-gray-600 mt-2">
                                    Open Warpcast → Scan → Point at this code
                                </p>
                            </div>
                            
                            <button
                                onClick={() => setShowQRConnection(false)}
                                className="text-blue-400 hover:text-blue-300 font-semibold"
                            >
                                ← Back to other options
                            </button>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-white/10">
                        <button
                            onClick={onExploreWithoutAuth}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-3 text-white font-semibold transition-colors"
                        >
                            👀 Explore First
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}