'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Leaderboard from '../Leaderboard';

type Props = {
  fid?: number;
  gameState: {
    cycleId: string;
    state: string;
    playerCount: number;
    registrationEnds: number;
    gameEnds: number;
    isRegistered: boolean;
  };
  onLogout: () => void;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * GameFinishedView - Displays when game is FINISHED
 * 
 * Shows the leaderboard and countdown to the next game cycle.
 */
export default function GameFinishedView({ fid, gameState, onLogout }: Props) {
  const [nextGameCountdown, setNextGameCountdown] = useState(0);

  // Fetch player stats
  const { data: statsData } = useSWR(
    fid ? `/api/stats/player/${fid}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const playerStats = statsData?.stats || {
    total_games: 0,
    accuracy: 0,
    avg_speed_ms: 0,
  };

  // Calculate time until next registration phase
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      // Next game should start 5 seconds after this game finishes
      // For now, estimate based on gameEnds + 5 second grace period
      const remaining = Math.max(0, gameState.gameEnds + 5000 - now);
      setNextGameCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [gameState.gameEnds]);

  const formatCountdown = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="hero-title text-3xl md:text-4xl font-black text-stroke mb-2">
          Game Over!
        </h2>
        <p className="text-gray-400 text-sm">
          Great job! See how you ranked against other players
        </p>
      </div>

      {/* Leaderboard */}
      <div className="space-y-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest px-4">Results</div>
        <Leaderboard />
      </div>

      {/* Next Steps */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Share Results */}
          <a
            href="https://warpcast.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-3 rounded-lg text-center text-sm font-semibold transition-all"
          >
            📊 Share Results
          </a>

          {/* View Stats */}
          <button
            onClick={() => {
              // TODO: Navigate to stats/profile page
              console.log('Navigate to stats');
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg text-center text-sm font-semibold transition-all"
          >
            📈 View Stats
          </button>
        </div>
      </div>

      {/* Countdown to Next Game */}
      {nextGameCountdown > 0 && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-green-500/30 rounded-xl p-6 text-center backdrop-blur-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Next Game Starts In</p>
          <div className="text-4xl font-black text-green-400 mb-1 font-mono">
            {formatCountdown(nextGameCountdown)}
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {gameState.playerCount > 0 ? `${gameState.playerCount} players registered` : 'Waiting for players...'}
          </p>
          
          {/* Auto Join or Manual */}
          <div className="space-y-2 pt-4 border-t border-slate-700">
            <p className="text-xs text-gray-400 mb-3">You'll automatically join the next game</p>
            <button
              onClick={onLogout}
              className="w-full text-xs text-gray-400 hover:text-gray-300 transition-colors py-2"
            >
              ← Leave & Return to Home
            </button>
          </div>
        </div>
      )}

      {/* Your Stats Summary */}
      <div className="bg-slate-900/30 border border-white/5 rounded-lg p-4 space-y-3">
        <div className="text-xs text-gray-500 uppercase tracking-widest">Your Stats</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black text-blue-400">{playerStats.total_games}</p>
            <p className="text-xs text-gray-500">Total Games</p>
          </div>
          <div>
            <p className="text-2xl font-black text-yellow-400">{playerStats.accuracy.toFixed(0)}%</p>
            <p className="text-xs text-gray-500">Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-black text-green-400">{playerStats.avg_speed_ms}ms</p>
            <p className="text-xs text-gray-500">Avg Speed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
