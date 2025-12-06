"use client";

import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import Leaderboard from "@/components/Leaderboard";

export default function LeaderboardPage() {
    return (
        <main className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
            <StarfieldBackground />

            <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8">
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
                        Multi-chain rankings across all ecosystems
                    </p>
                </div>

                {/* Multi-chain Leaderboard Component */}
                <div className="mb-8">
                    <Leaderboard mode="multi-chain" />
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