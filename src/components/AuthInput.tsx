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
        <div className="space-y-4">
            <div className="text-center">
                <p className="text-xs text-gray-200">
                    Enter your Farcaster username to play
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 flex flex-col items-center">
                <div className="w-full flex justify-center">
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g., dwr, v, jessepollak"
                        className="input-field py-2 text-center"
                        disabled={isLoading}
                    />
                </div>

                {error && (
                    <div className="bg-red-900/40 border border-red-500/60 rounded-lg p-2 text-red-200 text-xs">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="btn-primary w-full font-bold py-2 text-sm"
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                            <SpinningDetective size="md" />
                            <span>Connecting...</span>
                        </div>
                    ) : (
                        'Connect'
                    )}
                </button>
            </form>

            <div className="pt-3 border-t border-slate-700/50">
                <p className="text-xs text-gray-300 text-center">
                    Using Warpcast?{' '}
                    <a href="warpcast://detective" className="text-blue-300 hover:text-blue-200 font-medium">
                        Open in app
                    </a>
                </p>
            </div>
        </div>
    );
}
