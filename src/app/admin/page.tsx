'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import AnimatedGridBackdrop from '@/components/AnimatedGridBackdrop';
import StarfieldBackground from '@/components/StarfieldBackground';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminPage() {
    const router = useRouter();
    const [usernames, setUsernames] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Poll admin data every 3 seconds
    const { data: adminData, mutate } = useSWR('/api/admin/state', fetcher, {
        refreshInterval: 3000,
    });

    const handleBulkRegister = async () => {
        const usernameList = usernames
            .split('\n')
            .map((u) => u.trim())
            .filter((u) => u.length > 0);

        if (usernameList.length === 0) {
            setMessage({ type: 'error', text: 'Please enter at least one username' });
            return;
        }

        setIsRegistering(true);
        setMessage(null);

        try {
            const response = await fetch('/api/admin/register-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: usernameList }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({
                    type: 'success',
                    text: `Registered ${data.registered} users. ${data.failed} failed.`,
                });
                setUsernames('');
                mutate();
            } else {
                setMessage({ type: 'error', text: data.error || 'Registration failed' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsRegistering(false);
        }
    };

    const handleStateTransition = async (newState: 'REGISTRATION' | 'LIVE' | 'FINISHED') => {
        setIsTransitioning(true);
        setMessage(null);

        try {
            const response = await fetch('/api/admin/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'transition', state: newState }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                mutate();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsTransitioning(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Are you sure you want to reset the entire game?')) return;

        setIsTransitioning(true);
        setMessage(null);

        try {
            const response = await fetch('/api/admin/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset' }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                mutate();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsTransitioning(false);
        }
    };

    // Generate grid images array
    const gridImages = Array.from({ length: 9 }, (_, i) => `/grid-images/${i + 1}.jpg`);

    return (
        <main className="min-h-screen p-6 bg-slate-900 text-white relative flex items-center justify-center">
            {/* Layer 1: Starfield (deepest) */}
            <StarfieldBackground />

            {/* Layer 2: Grid Backdrop */}
            <AnimatedGridBackdrop images={gridImages} />

            <div className="max-w-6xl w-full relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">🔧 Admin Panel</h1>
                        <p className="text-gray-400">Game testing and control</p>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                    >
                        ← Back to Game
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                            ? 'bg-green-900/30 border border-green-500 text-green-400'
                            : 'bg-red-900/30 border border-red-500 text-red-400'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Game State Control */}
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">Game State</h2>

                        {adminData?.gameState && (
                            <div className="space-y-4">
                                <div className="bg-slate-900/50 rounded-lg p-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-400">Current State</p>
                                            <p className="text-2xl font-bold text-blue-400">
                                                {adminData.gameState.state}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Cycle ID</p>
                                            <p className="text-xs font-mono text-gray-300">
                                                {adminData.gameState.cycleId}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Players</p>
                                            <p className="text-xl font-bold">{adminData.gameState.playerCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Bots</p>
                                            <p className="text-xl font-bold">{adminData.gameState.botCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Matches</p>
                                            <p className="text-xl font-bold">{adminData.gameState.matchCount}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-sm text-gray-400 font-semibold">Transition to:</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => handleStateTransition('REGISTRATION')}
                                            disabled={isTransitioning || adminData.gameState.state === 'REGISTRATION'}
                                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            Registration
                                        </button>
                                        <button
                                            onClick={() => handleStateTransition('LIVE')}
                                            disabled={isTransitioning || adminData.gameState.state === 'LIVE'}
                                            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            Live
                                        </button>
                                        <button
                                            onClick={() => handleStateTransition('FINISHED')}
                                            disabled={isTransitioning || adminData.gameState.state === 'FINISHED'}
                                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            Finished
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleReset}
                                    disabled={isTransitioning}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-600 px-4 py-2 rounded-lg font-semibold transition-colors"
                                >
                                    Reset Game
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bulk User Registration */}
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">Register Test Users</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Farcaster Usernames (one per line)
                                </label>
                                <textarea
                                    value={usernames}
                                    onChange={(e) => setUsernames(e.target.value)}
                                    placeholder="dwr&#10;v&#10;jessepollak"
                                    rows={8}
                                    className="w-full bg-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    disabled={isRegistering}
                                />
                            </div>

                            <button
                                onClick={handleBulkRegister}
                                disabled={isRegistering || !usernames.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold transition-colors"
                            >
                                {isRegistering ? 'Registering...' : 'Register All Users'}
                            </button>

                            <div className="text-xs text-gray-400 space-y-1">
                                <p>• Each user will be fetched from Neynar</p>
                                <p>• Recent casts will be analyzed</p>
                                <p>• Bot impersonations will be created</p>
                                <p>• Profile pictures will be loaded</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Players List */}
                {adminData?.players && adminData.players.length > 0 && (
                    <div className="mt-6 bg-slate-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">Registered Players</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminData.players.map((player: any) => (
                                <div key={player.fid} className="bg-slate-900/50 rounded-lg p-4 flex items-center gap-3">
                                    <img
                                        src={player.pfpUrl}
                                        alt={player.username}
                                        className="w-12 h-12 rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{player.displayName}</p>
                                        <p className="text-sm text-gray-400 truncate">@{player.username}</p>
                                        <p className="text-xs text-gray-500">FID: {player.fid}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bots List */}
                {adminData?.bots && adminData.bots.length > 0 && (
                    <div className="mt-6 bg-slate-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">Bot Impersonations</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminData.bots.map((bot: any) => (
                                <div key={bot.fid} className="bg-slate-900/50 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <img
                                            src={bot.pfpUrl}
                                            alt={bot.username}
                                            className="w-12 h-12 rounded-full"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{bot.displayName}</p>
                                            <p className="text-sm text-gray-400 truncate">@{bot.username}</p>
                                        </div>
                                        <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-1 rounded">
                                            BOT
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <p>Style: {bot.style}</p>
                                        <p>Casts: {bot.recentCasts?.length || 0}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
