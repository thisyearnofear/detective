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
        <div className="bg-slate-800 rounded-lg p-8 mb-8">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Welcome to Detective</h2>
                <p className="text-gray-400">
                    Enter your Farcaster username to play
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                        Farcaster Username
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g., dwr, v, jessepollak"
                        className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    />
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                    {isLoading ? 'Connecting...' : 'Connect'}
                </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-xs text-gray-500 text-center">
                    Using Warpcast?{' '}
                    <a href="warpcast://detective" className="text-blue-400 hover:text-blue-300">
                        Open in app
                    </a>
                </p>
            </div>
        </div>
    );
}
