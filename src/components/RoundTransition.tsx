"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserProfile } from "@/lib/types";
import { AVAILABLE_MODELS } from "@/lib/openrouter";

type RevealData = {
  opponent: UserProfile;
  actualType: "REAL" | "BOT";
  llmModelId?: string;
  llmModelName?: string;
  userLlmGuess?: string;
};

interface RoundTransitionProps {
  isVisible: boolean;
  phase?: "reveal" | "loading";
  reveals?: RevealData[];
  stats?: {
    accuracy: number;
    correct: number;
    total: number;
    playerRank?: number;
    totalPlayers?: number;
  };
  nextRoundNumber?: number;
}

export default function RoundTransition({
  isVisible,
  phase = "loading",
  reveals = [],
  stats,
  nextRoundNumber,
}: RoundTransitionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isVisible || !mounted) return null;

  const renderInPortal = (content: React.ReactNode) => {
    if (typeof document === "undefined") return null;
    return createPortal(content, document.body);
  };

  // Reveal phase: show opponent reveals + stats
  if (phase === "reveal" && reveals.length > 0) {
    return renderInPortal(
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Round Complete</h2>
            <p className="text-gray-400">Opponents Revealed</p>
          </div>

          {/* Reveals Grid */}
          <div className={`grid ${reveals.length === 2 ? "grid-cols-2" : "grid-cols-1"} gap-4 mb-8`}>
            {reveals.map((reveal, idx) => {
              const isBot = reveal.actualType === "BOT";
              const borderColor = isBot ? "border-red-500" : "border-green-500";
              const bgGradient = isBot
                ? "from-red-900/20 to-red-800/10"
                : "from-green-900/20 to-green-800/10";

              const guessedCorrectly = isBot && reveal.userLlmGuess === reveal.llmModelId;

              return (
                <div
                  key={idx}
                  className={`bg-slate-900 rounded-lg border ${borderColor} overflow-hidden animate-scale-in`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className={`bg-gradient-to-r ${bgGradient} border-b border-slate-700 px-4 py-3`}>
                    <h3 className="text-lg font-bold text-white text-center">
                      {isBot ? "🤖 Bot Detected" : "👤 Real Person"}
                    </h3>
                  </div>

                  <div className="p-4 text-center space-y-3">
                    <img
                      src={reveal.opponent.pfpUrl}
                      alt={reveal.opponent.displayName}
                      className="w-16 h-16 rounded-full mx-auto border-3 border-slate-700 object-cover"
                    />

                    <div>
                      <h4 className="font-bold text-white text-sm">{reveal.opponent.displayName}</h4>
                      <p className="text-xs text-gray-400">@{reveal.opponent.username}</p>
                    </div>

                    <div className={`bg-gradient-to-r ${bgGradient} border ${borderColor} rounded px-3 py-2`}>
                      <p className="text-xs font-semibold text-white">
                        {isBot ? "AI Bot" : "Farcaster User"}
                      </p>
                    </div>

                    {/* LLM Reveal for Bots */}
                    {isBot && reveal.llmModelName && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-gray-400 mb-1">Powered by</p>
                        <div className={`
                          inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                          ${guessedCorrectly
                            ? "bg-green-500/20 text-green-300 border border-green-500/50"
                            : "bg-slate-700/50 text-gray-300 border border-slate-600"
                          }
                        `}>
                          <span>{guessedCorrectly ? "🎯" : "🤖"}</span>
                          <span className="text-sm font-medium">{reveal.llmModelName}</span>
                        </div>
                        {reveal.userLlmGuess && (
                          <p className="text-xs text-gray-500 mt-2">
                            You guessed: {
                              AVAILABLE_MODELS.find(m => m.id === reveal.userLlmGuess)?.name || reveal.userLlmGuess
                            }
                            {guessedCorrectly && <span className="text-green-400 ml-1">✓ (+5 pts)</span>}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats Section */}
          {stats && (
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 mb-6">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.accuracy.toFixed(0)}%</div>
                  <div className="text-xs text-gray-400 mt-1">Accuracy</div>
                  <div className="text-xs text-gray-500">{stats.correct}/{stats.total}</div>
                </div>

                {stats.playerRank !== undefined && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">#{stats.playerRank}</div>
                    <div className="text-xs text-gray-400 mt-1">Rank</div>
                    <div className="text-xs text-gray-500">of {stats.totalPlayers || "?"}</div>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{reveals.length}</div>
                  <div className="text-xs text-gray-400 mt-1">Matches</div>
                  <div className="text-xs text-gray-500">this round</div>
                </div>
              </div>

              {nextRoundNumber && (
                <div className="text-center pt-3 border-t border-slate-700">
                  <p className="text-sm text-gray-300">
                    Next Round: <span className="font-bold text-blue-300">Round {nextRoundNumber}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Status message - waiting for next round */}
          <div className="text-center">
            <div className="w-full bg-slate-700 rounded-full h-1 mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-1 rounded-full transition-all duration-100 animate-pulse"
                style={{ width: `100%` }}
              />
            </div>
            <p className="text-xs text-gray-400">Waiting for next round to start...</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading phase: show next round prep
  return renderInPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-block">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 animate-spin" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Preparing Round {nextRoundNumber}</h2>
        <p className="text-gray-400">Finding opponents...</p>
      </div>
    </div>
  );
}
