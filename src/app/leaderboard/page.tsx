"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import SpinningDetective from "@/components/SpinningDetective";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LeaderboardEntry {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    accuracy: number;
    avg_speed_ms: number;
    total_matches: number;
    total_games: number;
    total_wins: number;
    rank: number;
}

export default function LeaderboardPage() {
    // Tab state for future use (global vs recent games)
    const [_selectedTab, _setSelectedTab] = useState<"global" | "recent">("global");

    const { data: leaderboardData, error, isLoading } = useSWR(
        "/api/leaderboard/global?limit=100",
        fetcher,
        { refreshInterval: 30000 } // Refresh every 30 seconds
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <StarfieldBackground />
                <div className="text-center z-10">
                    <SpinningDetective size="xl" className="mb-6" />
                    <h1 className="hero-title text-3xl font-black text-stroke">Loading Leaderboard...</h1>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <StarfieldBackground />
                <div className="text-center text-red-400 z-10">
                    <h1 className="hero-title text-2xl font-black text-stroke">Error</h1>
                    <p className="text-sm mt-2">Failed to load leaderboard.</p>
                    <Link href="/" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    const leaderboard: LeaderboardEntry[] = leaderboardData?.leaderboard || [];

    return (
        <main className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
            <StarfieldBackground />

            <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block mb-4">
                        <span className="text-gray-400 hover:text-white transition-colors text-sm">
                            ← Back to Game
                        </span>
                    </Link>
                    <h1 className="hero-title text-5xl sm:text-6xl font-black text-stroke mb-2">
                        LEADERBOARD
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Top detectives ranked by accuracy and speed
                    </p>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 text-center border border-slate-700/50">
                        <p className="text-3xl font-black text-yellow-400">{leaderboard.length}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Qualified Players</p>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 text-center border border-slate-700/50">
                        <p className="text-3xl font-black text-green-400">
                            {leaderboard[0]?.accuracy?.toFixed(1) || "0"}%
                        </p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Top Accuracy</p>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 text-center border border-slate-700/50">
                        <p className="text-3xl font-black text-blue-400">
                            {leaderboard[0]?.avg_speed_ms ? `${(leaderboard[0].avg_speed_ms / 1000).toFixed(1)}s` : "N/A"}
                        </p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Fastest Avg</p>
                    </div>
                </div>

                {/* Leaderboard Table */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-900/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-4">Player</div>
                        <div className="col-span-2 text-center">Accuracy</div>
                        <div className="col-span-2 text-center">Avg Speed</div>
                        <div className="col-span-2 text-center">Matches</div>
                        <div className="col-span-1 text-center">Wins</div>
                    </div>

                    {/* Table Body */}
                    {leaderboard.length === 0 ? (
                        <div className="px-4 py-12 text-center text-gray-400">
                            <p className="text-lg mb-2">No qualified players yet</p>
                            <p className="text-sm">Play at least 5 matches to appear on the leaderboard</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700/50">
                            {leaderboard.map((entry, index) => (
                                <div
                                    key={entry.fid}
                                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-700/30 transition-colors ${
                                        index < 3 ? "bg-slate-700/20" : ""
                                    }`}
                                >
                                    {/* Rank */}
                                    <div className="col-span-1 text-center">
                                        {index === 0 && <span className="text-2xl">🥇</span>}
                                        {index === 1 && <span className="text-2xl">🥈</span>}
                                        {index === 2 && <span className="text-2xl">🥉</span>}
                                        {index > 2 && (
                                            <span className="text-gray-400 font-bold">{entry.rank}</span>
                                        )}
                                    </div>

                                    {/* Player */}
                                    <div className="col-span-4 flex items-center gap-3">
                                        {entry.pfp_url ? (
                                            <img
                                                src={entry.pfp_url}
                                                alt={entry.username}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                                                <span className="text-xs">👤</span>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-bold text-white truncate">
                                                {entry.display_name || entry.username}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">@{entry.username}</p>
                                        </div>
                                    </div>

                                    {/* Accuracy */}
                                    <div className="col-span-2 text-center">
                                        <span className={`font-bold ${
                                            (entry.accuracy ?? 0) >= 80 ? "text-green-400" :
                                            (entry.accuracy ?? 0) >= 60 ? "text-yellow-400" :
                                            "text-red-400"
                                        }`}>
                                            {(entry.accuracy ?? 0).toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Avg Speed */}
                                    <div className="col-span-2 text-center text-gray-300">
                                        {((entry.avg_speed_ms ?? 0) / 1000).toFixed(1)}s
                                    </div>

                                    {/* Matches */}
                                    <div className="col-span-2 text-center text-gray-300">
                                        {entry.total_matches}
                                    </div>

                                    {/* Wins */}
                                    <div className="col-span-1 text-center">
                                        <span className="text-yellow-400 font-bold">{entry.total_wins}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-6 text-center text-xs text-gray-500">
                    <p>Minimum 5 matches required to qualify for the leaderboard</p>
                    <p className="mt-1">Rankings update in real-time</p>
                </div>

                {/* Back to Home */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-bold"
                    >
                        <span>🔍</span>
                        <span>Play Detective</span>
                    </Link>
                </div>
            </div>
        </main>
    );
}