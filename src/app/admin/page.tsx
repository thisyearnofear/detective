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
        <main className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
            {/* Layer 1: Starfield (deepest) */}
            <StarfieldBackground />

            {/* Layer 2: Grid Backdrop */}
            <AnimatedGridBackdrop images={gridImages} />

            {/* Layer 3: Content Container */}
            <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
                {/* Header - Clean and centered */}
                <div className="w-full flex flex-col items-center text-center mb-12">
                    <div className="flex items-center justify-center w-16 h-16 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm mb-6">
                        <span className="text-2xl">🔧</span>
                    </div>
                    <h1 className="text-3xl font-light text-white/90 tracking-wide mb-3">System Control</h1>
                    <p className="text-sm text-white/60 mb-6">Game testing and administrative functions</p>
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center px-4 py-2 text-xs bg-white/5 border border-white/10 text-white/70 rounded-lg hover:bg-white/10 hover:text-white transition-all"
                    >
                        ← Return to Game
                    </button>
                </div>

                {/* Message - Clean styling */}
                {message && (
                    <div className="w-full mb-8">
                        <div
                            className={`p-4 rounded-lg text-center backdrop-blur-sm ${
                                message.type === 'success'
                                    ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                                    : 'bg-red-900/20 border border-red-500/30 text-red-400'
                            }`}
                        >
                            {message.text}
                        </div>
                    </div>
                )}

                {/* Main Content Grid - Centered */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Game State Control - Clean editorial design */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                        <h2 className="text-xl font-light text-white/90 tracking-wide mb-6 text-center">Game State</h2>

                        {adminData?.gameState && (
                            <div className="space-y-6">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                    <div className="grid grid-cols-2 gap-6 text-sm">
                                        <div className="text-center">
                                            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Current State</p>
                                            <p className="text-xl font-bold text-blue-400">
                                                {adminData.gameState.state}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Cycle ID</p>
                                            <p className="text-xs font-mono text-white/70">
                                                {adminData.gameState.cycleId}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Players</p>
                                            <p className="text-lg font-bold text-white">{adminData.gameState.playerCount}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Bots</p>
                                            <p className="text-lg font-bold text-white">{adminData.gameState.botCount}</p>
                                        </div>
                                        <div className="text-center col-span-2">
                                            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Total Matches</p>
                                            <p className="text-lg font-bold text-white">{adminData.gameState.matchCount}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-xs text-white/50 uppercase tracking-wider text-center">System Transitions</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => handleStateTransition('REGISTRATION')}
                                            disabled={isTransitioning || adminData.gameState.state === 'REGISTRATION'}
                                            className="bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 disabled:bg-white/5 disabled:border-white/10 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-xs font-medium text-blue-200 hover:text-blue-100 transition-all"
                                        >
                                            Registration
                                        </button>
                                        <button
                                            onClick={() => handleStateTransition('LIVE')}
                                            disabled={isTransitioning || adminData.gameState.state === 'LIVE'}
                                            className="bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 disabled:bg-white/5 disabled:border-white/10 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-xs font-medium text-green-200 hover:text-green-100 transition-all"
                                        >
                                            Live
                                        </button>
                                        <button
                                            onClick={() => handleStateTransition('FINISHED')}
                                            disabled={isTransitioning || adminData.gameState.state === 'FINISHED'}
                                            className="bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 disabled:bg-white/5 disabled:border-white/10 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-xs font-medium text-purple-200 hover:text-purple-100 transition-all"
                                        >
                                            Finished
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleReset}
                                    disabled={isTransitioning}
                                    className="w-full bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 disabled:bg-white/5 disabled:border-white/10 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-xs font-medium text-red-200 hover:text-red-100 transition-all"
                                >
                                    Reset Game
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bulk User Registration - Clean editorial design */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                        <h2 className="text-xl font-light text-white/90 tracking-wide mb-6 text-center">Register Test Users</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs text-white/50 uppercase tracking-wider mb-3 text-center">
                                    Farcaster Usernames
                                </label>
                                <textarea
                                    value={usernames}
                                    onChange={(e) => setUsernames(e.target.value)}
                                    placeholder="dwr&#10;v&#10;jessepollak"
                                    rows={8}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 font-mono text-sm backdrop-blur-sm transition-all"
                                    disabled={isRegistering}
                                />
                            </div>

                            <button
                                onClick={handleBulkRegister}
                                disabled={isRegistering || !usernames.trim()}
                                className="w-full bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 disabled:bg-white/5 disabled:border-white/10 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-sm font-medium text-blue-200 hover:text-blue-100 transition-all"
                            >
                                {isRegistering ? 'Registering...' : 'Register All Users'}
                            </button>

                            <div className="text-xs text-white/40 space-y-1 text-center">
                                <p>• Each user will be fetched from Neynar</p>
                                <p>• Recent casts will be analyzed</p>
                                <p>• Bot impersonations will be created</p>
                                <p>• Profile pictures will be loaded</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Players List - Clean editorial design */}
                {adminData?.players && adminData.players.length > 0 && (
                    <div className="w-full mt-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                        <h2 className="text-xl font-light text-white/90 tracking-wide mb-6 text-center">Registered Players</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminData.players.map((player: any) => (
                                <div key={player.fid} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
                                    <img
                                        src={player.pfpUrl}
                                        alt={player.username}
                                        className="w-12 h-12 rounded-full border border-white/20"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white truncate">{player.displayName}</p>
                                        <p className="text-sm text-white/70 truncate">@{player.username}</p>
                                        <p className="text-xs text-white/40">FID: {player.fid}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bots List - Clean editorial design */}
                {adminData?.bots && adminData.bots.length > 0 && (
                    <div className="w-full mt-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-6">
                        <h2 className="text-xl font-light text-white/90 tracking-wide mb-6 text-center">Bot Impersonations</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminData.bots.map((bot: any) => (
                                <div key={bot.fid} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <img
                                            src={bot.pfpUrl}
                                            alt={bot.username}
                                            className="w-12 h-12 rounded-full border border-white/20"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">{bot.displayName}</p>
                                            <p className="text-sm text-white/70 truncate">@{bot.username}</p>
                                        </div>
                                        <span className="bg-purple-900/30 text-purple-300 text-xs px-2 py-1 rounded border border-purple-500/30">
                                            BOT
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/40 space-y-1">
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
