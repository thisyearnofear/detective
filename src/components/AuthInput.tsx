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
            <div className="text-center space-y-2">
                <p className="text-sm font-medium text-blue-200 tracking-wide uppercase opacity-80" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Identity Verification
                </p>
                <p className="text-xs text-gray-400">
                    Enter your Farcaster username to access the network
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
                        placeholder="e.g., dwr"
                        className="relative w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-center text-white placeholder-gray-600 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 transition-all duration-300 font-mono text-lg tracking-wider"
                        disabled={isLoading}
                        autoComplete="off"
                        spellCheck="false"
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-200 text-xs text-center backdrop-blur-sm animate-fade-in">
                        ⚠️ {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="w-full relative group overflow-hidden rounded-xl p-[1px]"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative bg-slate-900/90 hover:bg-slate-900/50 rounded-[11px] px-4 py-3 transition-colors duration-300">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 text-white/80">
                                <SpinningDetective size="md" />
                                <span className="text-sm font-bold tracking-wide uppercase">Connecting...</span>
                            </div>
                        ) : (
                            <span className="text-sm font-bold text-white tracking-widest uppercase group-hover:text-blue-200 transition-colors">
                                Connect
                            </span>
                        )}
                    </div>
                </button>
            </form>

            <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest">
                    Or open in <a href="warpcast://detective" className="text-blue-400 hover:text-blue-300 transition-colors font-bold">Farcaster</a>
                </p>
            </div>
        </div>
    );
}
