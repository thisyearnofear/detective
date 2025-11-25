'use client';

import useSWR from 'swr';
import { LeaderboardEntry } from '@/lib/types';
import Image from 'next/image';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type LeaderboardMode = 'current' | 'career';

interface CareerStats {
  totalGames: number;
  overallAccuracy: number;
  totalVotes: number;
  totalCorrect: number;
  bestAccuracy: number;
  worstAccuracy: number;
  avgSpeed: number;
  leaderboardHistory: Array<{
    gameId: string;
    timestamp: number;
    rank: number;
    totalPlayers: number;
    accuracy: number;
  }>;
}

const getRankColor = (rank: number) => {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-yellow-600';
  return 'text-gray-500';
};

interface GameResultsProps {
  isGameEnd?: boolean;
  accuracy?: number;
  roundResults?: Array<{ roundNumber: number; correct: boolean; opponentUsername: string; opponentType: "REAL" | "BOT" }>;
  playerRank?: number;
  totalPlayers?: number;
  onPlayAgain?: () => void;
}

export default function Leaderboard({ 
  fid, 
  mode: initialMode = 'current',
  isGameEnd = false,
  accuracy = 0,
  roundResults = [],
  playerRank = 1,
  totalPlayers = 1,
  onPlayAgain,
}: { fid?: number; mode?: LeaderboardMode } & GameResultsProps = {}) {
  const [mode, setMode] = useState<LeaderboardMode>(initialMode);
  
  const { data: leaderboard, error } = useSWR<LeaderboardEntry[]>(
    (mode as string) === 'current' ? '/api/leaderboard/current' : null,
    fetcher, 
    {
      refreshInterval: 10000,
    }
  );

  const { data: careerStats } = useSWR<CareerStats>(
    (mode as string) === 'career' && fid ? `/api/stats/career?fid=${fid}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  // Game end mode - show results with current leaderboard
  if (isGameEnd) {
    const percentile = totalPlayers > 0 ? Math.round(((totalPlayers - playerRank) / totalPlayers) * 100) : 0;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
        {/* Results Summary */}
        <div className="max-w-2xl w-full mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-white mb-2">🎮 Mission Complete</h1>
            <p className="text-xl font-bold text-slate-300">GAME OVER</p>
            <p className="text-sm text-gray-400 mt-2">Here's how you performed</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700">
              <div className="text-4xl font-bold text-purple-400 mb-2">{accuracy.toFixed(0)}%</div>
              <div className="text-xs text-gray-400 uppercase">Accuracy</div>
              <div className="text-sm text-gray-500 mt-1">
                {roundResults.filter(r => r.correct).length}/{roundResults.length} correct
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700">
              <div className="text-4xl font-bold text-yellow-400 mb-2">#{playerRank}</div>
              <div className="text-xs text-gray-400 uppercase">Rank</div>
              <div className="text-sm text-gray-500 mt-1">of {totalPlayers}</div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700">
              <div className="text-4xl font-bold text-blue-400 mb-2">{percentile}%</div>
              <div className="text-xs text-gray-400 uppercase">Percentile</div>
              <div className="text-sm text-gray-500 mt-1">top players</div>
            </div>
          </div>

          {/* Motivation */}
          <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700 mb-8">
            <p className="text-gray-300 text-sm">
              {accuracy >= 80 ? "🔥 Incredible detective work! You're a natural." :
               accuracy >= 60 ? "💪 Nice work! Keep playing to improve." :
               accuracy >= 40 ? "📈 Not bad! You'll get better with practice." :
               "🎯 Keep playing - You'll improve"}
            </p>
          </div>

          {/* Round Breakdown */}
          {roundResults.length > 0 && (
            <div className="mb-8">
              <h3 className="font-bold text-white mb-4 text-center">Round Breakdown</h3>
              <div className="space-y-2">
                {roundResults.map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700/50">
                    <div className="text-sm text-gray-400">
                      Round {result.roundNumber} <span className="text-gray-600">vs @{result.opponentUsername}</span> <span className={result.opponentType === 'BOT' ? 'text-red-400' : 'text-green-400'}>{result.opponentType}</span>
                    </div>
                    <div className="text-lg">{result.correct ? '✅' : '❌'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={onPlayAgain}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
            >
              Register for Next Game
            </button>
            <a
              href="/"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
            >
              Back to Home
            </a>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">Stats saved automatically</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-red-400">Failed to load leaderboard.</div>;
  }

  if (!leaderboard) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-gray-400">Loading Leaderboard...</div>;
  }

  // Career stats mode
  if ((mode as string) === 'career') {
    if (!careerStats) {
      return (
        <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center">
          <div className="animate-pulse mb-4">
            <div className="h-8 bg-slate-700 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-32 mx-auto"></div>
          </div>
          <p className="text-gray-500">Loading your stats...</p>
        </div>
      );
    }

    const speedSeconds = (careerStats.avgSpeed / 1000).toFixed(1);

    return (
      <div className="bg-slate-800 rounded-lg p-6 mt-8">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setMode('current' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'current'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Current Game
          </button>
          <button
            onClick={() => setMode('career' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'career'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Career Stats
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">Career Stats</h2>

        {/* Main stats grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Games Played</div>
            <div className="text-3xl font-bold text-white">
              {careerStats.totalGames}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-purple-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Overall Accuracy</div>
            <div className="text-3xl font-bold text-purple-300">
              {careerStats.overallAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {careerStats.totalCorrect} of {careerStats.totalVotes} correct
            </div>
          </div>

          <div className="bg-slate-900/50 border border-green-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Best Game</div>
            <div className="text-3xl font-bold text-green-400">
              {careerStats.bestAccuracy.toFixed(0)}%
            </div>
          </div>

          <div className="bg-slate-900/50 border border-blue-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Avg Decision Speed</div>
            <div className="text-3xl font-bold text-blue-400">{speedSeconds}s</div>
            <div className="text-xs text-gray-500 mt-1">per correct vote</div>
          </div>
        </div>

        {/* Game history */}
        {careerStats.leaderboardHistory.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-white mb-3">Game History</h3>
            <div className="space-y-2">
              {careerStats.leaderboardHistory.map((entry, idx) => {
                const date = new Date(entry.timestamp).toLocaleDateString();
                const percentile = Math.round(
                  ((entry.totalPlayers - entry.rank) / entry.totalPlayers) * 100
                );

                return (
                  <div
                    key={entry.gameId}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        Game #{careerStats.totalGames - idx}
                      </div>
                      <div className="text-xs text-gray-500">{date}</div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-300">
                          {entry.accuracy.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-500">accuracy</div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-300">
                          #{entry.rank}
                        </div>
                        <div className="text-xs text-gray-500">
                          top {percentile}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        {careerStats.totalGames > 0 && (
          <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-4 mt-6">
            <h3 className="font-bold text-white mb-2">Insights</h3>
            <div className="space-y-2 text-sm text-gray-300">
              {careerStats.totalGames < 3 ? (
                <p>💡 Play more games to unlock deeper insights about your playstyle!</p>
              ) : (
                <>
                  <p>
                    📈{' '}
                    {careerStats.overallAccuracy >= 60
                      ? "You're above average! Keep playing to stay sharp."
                      : 'Keep practicing - you improve with each game!'}
                  </p>
                  <p>
                    ⚡ You make decisions{' '}
                    {careerStats.avgSpeed < 20000
                      ? 'very quickly'
                      : careerStats.avgSpeed < 35000
                        ? 'at a good pace'
                        : 'more carefully'}{' '}
                    - this is your strength!
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Current game leaderboard mode
  if (!leaderboard) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-gray-400">Loading Leaderboard...</div>;
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 mt-8">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setMode('current' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'current'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Current Game
          </button>
          {fid && (
            <button
              onClick={() => setMode('career' as LeaderboardMode)}
              className={`px-4 py-2 font-medium transition-colors ${
                (mode as string) === 'career'
                  ? 'border-b-2 border-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Career Stats
            </button>
          )}
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
        <p className="text-gray-400 text-center">No scores recorded yet. Play a match to get on the board!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 mt-8">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        <button
          onClick={() => setMode('current' as LeaderboardMode)}
          className={`px-4 py-2 font-medium transition-colors ${
            (mode as string) === 'current'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Current Game
        </button>
        {fid && (
          <button
            onClick={() => setMode('career' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'career'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Career Stats
          </button>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-slate-700">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-0">Rank</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Player</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {leaderboard.map((entry, index) => (
                  <tr key={entry.player.fid}>
                    <td className={`whitespace-nowrap py-4 pl-4 pr-3 text-lg font-bold sm:pl-0 ${getRankColor(index + 1)}`}>
                      #{index + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <Image className="h-10 w-10 rounded-full" src={entry.player.pfpUrl} alt="" width={40} height={40} />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-white">{entry.player.displayName}</div>
                          <div className="text-gray-500">@{entry.player.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-lg font-semibold text-white">{entry.accuracy.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

