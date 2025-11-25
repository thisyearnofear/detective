"use client";

import { useState, useEffect } from "react";

type ResultsMode = "opponent-reveal" | "round-summary" | "game-complete";

interface RoundResult {
  roundNumber: number;
  correct: boolean;
  opponentUsername: string;
  opponentType: "REAL" | "BOT";
}

interface ResultsCardProps {
  isVisible: boolean;
  mode: ResultsMode;
  roundNumber?: number;
  totalRounds?: number;
  correctVotes?: number;
  totalVotes?: number;
  nextRoundIn?: number; // seconds
  // Opponent reveal mode
  opponent?: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  };
  actualType?: "REAL" | "BOT";
  // Game complete mode
  accuracy?: number;
  roundResults?: RoundResult[];
  leaderboardRank?: number;
  totalPlayers?: number;
  onPlayAgain?: () => void;
}

export default function ResultsCard({
  isVisible,
  mode,
  roundNumber = 1,
  totalRounds = 5,
  correctVotes = 0,
  totalVotes = 1,
  nextRoundIn = 0,
  opponent,
  actualType,
  accuracy = 0,
  roundResults = [],
  leaderboardRank = 1,
  totalPlayers = 1,
  onPlayAgain,
}: ResultsCardProps) {
  const [countdownSeconds, setCountdownSeconds] = useState(nextRoundIn);

  useEffect(() => {
    if (nextRoundIn <= 0) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRoundIn]);

  if (!isVisible) return null;

  const isLastRound = roundNumber === totalRounds;
  const roundAccuracy = totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0;
  const percentile = Math.round(((totalPlayers - leaderboardRank) / totalPlayers) * 100);

  // Opponent reveal mode - brief reveal of who they faced
  if (mode === "opponent-reveal" && opponent && actualType) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800 border-2 border-slate-700 rounded-lg p-8 max-w-md mx-4 transform transition-all duration-500 scale-100 opacity-100 animate-scale-in">
          <div className="text-center">
            {/* Opponent avatar */}
            <div className="mb-6">
              <img
                src={opponent.pfpUrl}
                alt={opponent.displayName}
                className="w-24 h-24 rounded-full mx-auto border-4 border-slate-700 object-cover"
              />
            </div>

            {/* Opponent info */}
            <h3 className="text-xl font-bold text-white mb-1">
              {opponent.displayName}
            </h3>
            <p className="text-sm text-gray-400 mb-6">@{opponent.username}</p>

            {/* Reveal */}
            <div
              className={`inline-block px-6 py-3 rounded-lg font-bold text-lg ${
                actualType === "REAL"
                  ? "bg-green-900/50 border border-green-500 text-green-300"
                  : "bg-red-900/50 border border-red-500 text-red-300"
              }`}
            >
              {actualType === "REAL" ? "👤 Real Person" : "🤖 AI Bot"}
            </div>

            <p className="text-sm text-gray-400 mt-4">
              {actualType === "REAL"
                ? "You were chatting with a real Farcaster user!"
                : "That was an AI trained on their recent posts."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Round summary mode - shows accuracy for the round
  if (mode === "round-summary") {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 max-w-md w-full mx-4 border border-slate-700 shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Round {roundNumber} Complete!
            </h2>
            <p className="text-gray-400 text-sm">
              {roundNumber} of {totalRounds}
            </p>
          </div>

          {/* Accuracy Display */}
          <div className="mb-8">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border-2 border-blue-500/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{roundAccuracy}%</div>
                  <div className="text-xs text-gray-400">Accuracy</div>
                </div>
              </div>

              {/* Vote Breakdown */}
              <div className="text-center">
                <p className="text-gray-300 font-medium">
                  {correctVotes} / {totalVotes} correct
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalVotes === 2 ? "Both chats evaluated" : "Single chat"}
                </p>
              </div>
            </div>
          </div>

          {/* Progress to Next Round */}
          {!isLastRound && nextRoundIn > 0 && (
            <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <p className="text-sm text-gray-400 text-center mb-2">
                Next round starts in
              </p>
              <div className="text-2xl font-bold text-white text-center">
                {countdownSeconds}s
              </div>
            </div>
          )}

          {/* Stats Footer */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-gray-500">Rounds</p>
                <p className="text-white font-semibold mt-1">
                  {roundNumber}/{totalRounds}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Chats</p>
                <p className="text-white font-semibold mt-1">
                  {totalVotes}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Score</p>
                <p className="text-white font-semibold mt-1">
                  {correctVotes}pts
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game complete mode - full results summary
  if (mode === "game-complete") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 to-slate-900 z-50 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center py-8 px-4">
          <div className="w-full max-w-lg">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4" role="img" aria-label="celebration">
                🎉
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Game Complete!
              </h1>
              <p className="text-gray-400">Here's how you did this round</p>
            </div>

            {/* Main Stats Card */}
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 mb-6 shadow-2xl">
              {/* Accuracy Circle */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-28 h-28 mb-4">
                  {/* Background ring */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      stroke="url(#gradient)"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(accuracy / 100) * 301.6} 301.6`}
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{accuracy.toFixed(0)}%</span>
                    <span className="text-xs text-gray-400">Accuracy</span>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="text-center">
                  <span className="text-2xl font-bold text-green-400">
                    {roundResults.filter((r) => r.correct).length}
                  </span>
                  <span className="text-xl text-gray-500 mx-1">/</span>
                  <span className="text-xl text-gray-300">{roundResults.length}</span>
                  <span className="text-gray-500 ml-2">correct</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-900/60 rounded-xl p-4 text-center border border-slate-700/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rank</div>
                  <div className="text-2xl font-bold text-white">#{leaderboardRank}</div>
                  <div className="text-xs text-gray-500">of {totalPlayers}</div>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-4 text-center border border-slate-700/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Percentile</div>
                  <div className="text-2xl font-bold text-white">{percentile}%</div>
                  <div className="text-xs text-gray-500">top players</div>
                </div>
              </div>

              {/* Performance message */}
              <div className="text-center py-3 px-4 rounded-lg bg-slate-900/40 border border-slate-700/50">
                {accuracy >= 80 && (
                  <p className="text-yellow-400 font-medium">
                    <span className="mr-2" role="img" aria-label="star">⭐</span>
                    Outstanding! You're a detective master!
                  </p>
                )}
                {accuracy >= 60 && accuracy < 80 && (
                  <p className="text-green-400 font-medium">
                    <span className="mr-2" role="img" aria-label="thumbs up">👍</span>
                    Great job! You're getting the hang of this!
                  </p>
                )}
                {accuracy >= 40 && accuracy < 60 && (
                  <p className="text-blue-400 font-medium">
                    <span className="mr-2" role="img" aria-label="chart">📊</span>
                    Good effort! Practice makes perfect!
                  </p>
                )}
                {accuracy < 40 && (
                  <p className="text-purple-400 font-medium">
                    <span className="mr-2" role="img" aria-label="muscle">💪</span>
                    Keep playing! You'll improve with more rounds!
                  </p>
                )}
              </div>
            </div>

            {/* Round by round breakdown */}
            {roundResults.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Round Breakdown
                </h2>
                <div className="space-y-2">
                  {roundResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur transition-all duration-300 ${
                        result.correct
                          ? "bg-green-900/20 border-green-500/30"
                          : "bg-red-900/20 border-red-500/30"
                      }`}
                    >
                      <div className="text-xl flex-shrink-0" role="img" aria-label={result.correct ? "correct" : "incorrect"}>
                        {result.correct ? "✅" : "❌"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">
                          Round {result.roundNumber}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          vs @{result.opponentUsername}{" "}
                          <span className="text-gray-500">
                            ({result.opponentType === "REAL" ? "Human" : "Bot"})
                          </span>
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        result.opponentType === "REAL"
                          ? "bg-green-900/30 text-green-400 border border-green-500/30"
                          : "bg-red-900/30 text-red-400 border border-red-500/30"
                      }`}>
                        {result.opponentType === "REAL" ? "👤" : "🤖"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call to action */}
            <div className="space-y-3 mb-6">
              <button
                onClick={onPlayAgain}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
              >
                Play Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="w-full bg-slate-800/80 hover:bg-slate-700 text-gray-300 font-medium py-3 px-6 rounded-xl transition-all duration-300 border border-slate-600 active:scale-[0.98]"
              >
                View Leaderboard
              </button>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500">
              <p>Your stats are saved automatically</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
