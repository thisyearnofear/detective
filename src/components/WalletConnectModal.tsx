'use client';

import { useState } from 'react';
import { useConnect } from 'wagmi';
import SpinningDetective from './SpinningDetective';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onWalletConnected: () => void;
};

export default function WalletConnectModal({ isOpen, onClose, onWalletConnected }: Props) {
    const [isConnecting, setIsConnecting] = useState(false);
    const { connect, connectors } = useConnect();

    const handleConnect = async (connector: any) => {
        setIsConnecting(true);
        try {
            connect({ connector });
            onWalletConnected();
        } catch (error) {
            console.error('Wallet connection failed:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-gray-900/95 border-2 border-white/20 rounded-2xl p-6 max-w-sm w-full backdrop-blur-md">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Connect Wallet</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {isConnecting ? (
                    <div className="flex items-center justify-center py-8">
                        <SpinningDetective size="lg" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {connectors.map((connector) => (
                            <button
                                key={connector.id}
                                onClick={() => handleConnect(connector)}
                                className="w-full bg-white/8 hover:bg-white/12 border-2 border-white/15 hover:border-white/25 rounded-xl px-5 py-4 text-white font-bold transition-all duration-300 backdrop-blur-sm text-left flex items-center gap-3"
                            >
                                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                                    🔗
                                </div>
                                {connector.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-white/10 text-center space-y-2">
                    <p className="text-xs text-gray-400">
                        Using Farcaster app? <a href="warpcast://detective" className="text-blue-400 hover:text-blue-300 transition-colors font-semibold">Open there</a>
                    </p>
                </div>
            </div>
        </div>
    );
}