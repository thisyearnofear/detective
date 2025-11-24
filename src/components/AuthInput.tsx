'use client';

import { useState } from 'react';

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
            <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-lg">Welcome to Detective</h2>
                <p className="text-sm sm:text-base text-gray-200 drop-shadow-md">
                    Enter your Farcaster username to play
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-200 mb-2 drop-shadow-sm">
                        Farcaster Username
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g., dwr, v, jessepollak"
                        className="w-full bg-slate-700/70 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-slate-600/70"
                        disabled={isLoading}
                    />
                </div>

                {error && (
                    <div className="bg-red-900/40 border border-red-500/60 rounded-lg p-3 text-red-200 text-sm drop-shadow-sm">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl drop-shadow-lg"
                >
                    {isLoading ? 'Connecting...' : 'Connect'}
                </button>
            </form>

            <div className="pt-4 border-t border-slate-700/50">
                <p className="text-xs text-gray-300 text-center drop-shadow-sm">
                    Using Warpcast?{' '}
                    <a href="warpcast://detective" className="text-blue-300 hover:text-blue-200 font-medium">
                        Open in app
                    </a>
                </p>
            </div>
        </div>
    );
}
