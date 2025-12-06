'use client';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    walletAddress: string;
};

export default function FarcasterSetupModal({ isOpen, onClose, walletAddress }: Props) {
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
                    <div className="text-6xl">🎯</div>
                    
                    <div className="space-y-3">
                        <h3 className="text-xl font-bold text-white">Farcaster Account Required</h3>
                        <p className="text-sm text-gray-300">
                            To play Detective, you need a Farcaster account connected to your wallet.
                        </p>
                    </div>

                    <div className="bg-blue-500/15 border-2 border-blue-500/30 rounded-xl p-4 text-blue-200 text-sm">
                        <p className="font-semibold mb-2">Your connected wallet:</p>
                        <p className="font-mono text-xs break-all bg-white/10 p-2 rounded">
                            {walletAddress}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-gray-400">
                            Set up your Farcaster account and connect this wallet:
                        </p>
                        
                        <a
                            href="https://warpcast.com/~/signup?ref=detective"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full bg-purple-600 hover:bg-purple-700 border-2 border-purple-500 rounded-xl px-6 py-4 text-white font-bold transition-all duration-300"
                        >
                            🚀 Create Farcaster Account
                        </a>
                        
                        <p className="text-xs text-gray-500">
                            Already have Farcaster? Make sure your wallet is connected in your profile settings.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-3 text-white font-semibold transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}