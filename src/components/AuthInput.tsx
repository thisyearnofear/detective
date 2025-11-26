'use client';

import { useState } from 'react';
import SpinningDetective from './SpinningDetective';

type Props = {
    onAuthSuccess: (userProfile: {
        fid: number;
        username: string;
        displayName: string;
        pfpUrl: string;
    }) => void;
};

export default function AuthInput({ onAuthSuccess }: Props) {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/auth/web?username=${encodeURIComponent(username.trim())}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to authenticate');
            }

            if (data.success && data.userProfile) {
                onAuthSuccess(data.userProfile);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-3">
                <h3 className="text-lg font-bold text-white">Join the Game</h3>
                <p className="text-sm text-gray-400">
                    Enter your Farcaster username to start playing
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative group">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md transition-opacity opacity-0 group-hover:opacity-100" />
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your-username"
                        className="relative w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-4 text-center text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 text-lg"
                        disabled={isLoading}
                        autoComplete="off"
                        spellCheck="false"
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-200 text-sm text-center backdrop-blur-sm animate-fade-in">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="w-full btn-primary text-base py-4"
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                            <SpinningDetective size="md" />
                            <span>Connecting...</span>
                        </div>
                    ) : (
                        'Continue'
                    )}
                </button>
            </form>

            <div className="pt-4 border-t border-white/5 text-center">
                <p className="text-xs text-gray-500">
                    Using Farcaster app? <a href="warpcast://detective" className="text-blue-400 hover:text-blue-300 transition-colors">Open there</a>
                </p>
            </div>
        </div>
    );
}
