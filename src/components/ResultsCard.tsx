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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card max-w-md w-full animate-scale-in">
          <div className="text-center space-y-6">
            {/* Opponent avatar */}
            <div>
              <img
                src={opponent.pfpUrl}
                alt={opponent.displayName}
                className="w-20 h-20 rounded-full mx-auto border-2 border-white/20 object-cover"
              />
            </div>

            {/* Opponent info */}
            <div>
              <h3 className="text-lg font-bold text-white">
                {opponent.displayName}
              </h3>
              <p className="text-sm text-white/50">@{opponent.username}</p>
            </div>

            {/* Reveal */}
            <div
              className={`inline-block px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest ${
                actualType === "REAL"
                  ? "bg-green-500/20 border border-green-500/50 text-green-400"
                  : "bg-red-500/20 border border-red-500/50 text-red-400"
              }`}
            >
              {actualType === "REAL" ? "HUMAN" : "AI BOT"}
            </div>

            <p className="text-sm text-white/40">
              {actualType === "REAL"
                ? "You were chatting with a real Farcaster user"
                : "That was an AI trained on their recent posts"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Round summary mode - shows accuracy for the round
  if (mode === "round-summary") {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card max-w-md w-full animate-scale-in">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-xs font-medium text-white/50 uppercase tracking-[0.3em] mb-2">
              Round {roundNumber} of {totalRounds}
            </p>
            <h2 className="hero-title text-4xl font-black text-stroke">
              COMPLETE
            </h2>
          </div>

          {/* Accuracy Display */}
          <div className="text-center mb-8">
            <div className="hero-title text-6xl font-black text-white mb-2">
              {roundAccuracy}%
            </div>
            <p className="text-sm text-white/50 uppercase tracking-widest">
              Accuracy
            </p>
            <p className="text-white/70 mt-2">
              {correctVotes} / {totalVotes} correct
            </p>
          </div>

          {/* Progress to Next Round */}
          {!isLastRound && nextRoundIn > 0 && (
            <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs text-white/50 uppercase tracking-widest mb-2">
                Next round in
              </p>
              <div className="hero-title text-3xl font-black text-white">
                {countdownSeconds}s
              </div>
            </div>
          )}

          {/* Stats Footer */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Rounds</p>
                <p className="text-white font-bold mt-1">
                  {roundNumber}/{totalRounds}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Chats</p>
                <p className="text-white font-bold mt-1">
                  {totalVotes}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Score</p>
                <p className="text-white font-bold mt-1">
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
      <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-start py-12 px-4">
          <div className="w-full max-w-lg space-y-8">
            
            {/* Header */}
            <div className="text-center space-y-4">
              <p className="text-xs font-medium text-white/50 uppercase tracking-[0.3em]">
                Mission Complete
              </p>
              <h1 className="hero-title text-5xl sm:text-6xl font-black text-stroke">
                GAME OVER
              </h1>
              <p className="text-white/40 text-sm">Here's how you performed</p>
            </div>

            {/* Main Stats Card */}
            <div className="card space-y-8">
              {/* Accuracy - Large Display */}
              <div className="text-center">
                <div className="hero-title text-7xl sm:text-8xl font-black text-white">
                  {accuracy.toFixed(0)}%
                </div>
                <p className="text-xs text-white/50 uppercase tracking-[0.3em] mt-2">
                  Accuracy
                </p>
                <p className="text-white/70 mt-4 text-lg">
                  <span className="text-green-400 font-bold">
                    {roundResults.filter((r) => r.correct).length}
                  </span>
                  <span className="text-white/30 mx-2">/</span>
                  <span>{roundResults.length}</span>
                  <span className="text-white/50 ml-2">correct</span>
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Rank</p>
                  <p className="hero-title text-3xl font-black text-white">#{leaderboardRank}</p>
                  <p className="text-xs text-white/40 mt-1">of {totalPlayers}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Percentile</p>
                  <p className="hero-title text-3xl font-black text-white">{percentile}%</p>
                  <p className="text-xs text-white/40 mt-1">top players</p>
                </div>
              </div>

              {/* Performance message */}
              <div className="text-center py-4 px-6 rounded-xl bg-white/5 border border-white/10">
                {accuracy >= 80 && (
                  <p className="text-yellow-400 font-medium uppercase tracking-wider text-sm">
                    Outstanding - Detective Master
                  </p>
                )}
                {accuracy >= 60 && accuracy < 80 && (
                  <p className="text-green-400 font-medium uppercase tracking-wider text-sm">
                    Great Job - Getting the hang of it
                  </p>
                )}
                {accuracy >= 40 && accuracy < 60 && (
                  <p className="text-blue-400 font-medium uppercase tracking-wider text-sm">
                    Good Effort - Practice makes perfect
                  </p>
                )}
                {accuracy < 40 && (
                  <p className="text-purple-400 font-medium uppercase tracking-wider text-sm">
                    Keep Playing - You'll improve
                  </p>
                )}
              </div>
            </div>

            {/* Round by round breakdown */}
            {roundResults.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xs font-medium text-white/50 uppercase tracking-[0.3em] text-center">
                  Round Breakdown
                </h2>
                <div className="space-y-2">
                  {roundResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-4 p-4 rounded-xl border backdrop-blur transition-all duration-300 ${
                        result.correct
                          ? "bg-green-500/10 border-green-500/30"
                          : "bg-red-500/10 border-red-500/30"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        result.correct
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {result.correct ? "+" : "-"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">
                          Round {result.roundNumber}
                        </div>
                        <div className="text-xs text-white/50 truncate">
                          vs @{result.opponentUsername}
                        </div>
                      </div>
                      <div className={`text-xs px-3 py-1 rounded-full font-medium uppercase tracking-wider ${
                        result.opponentType === "REAL"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}>
                        {result.opponentType === "REAL" ? "Human" : "Bot"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call to action */}
            <div className="space-y-3">
              <button
                onClick={onPlayAgain}
                className="btn-primary w-full py-4 text-base font-bold uppercase tracking-widest"
              >
                Register for Next Game
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="btn-secondary w-full py-3 text-sm uppercase tracking-widest"
              >
                Back to Home
              </button>
            </div>

            {/* Footer */}
            <div className="text-center">
              <p className="text-xs text-white/30 uppercase tracking-widest">
                Stats saved automatically
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
