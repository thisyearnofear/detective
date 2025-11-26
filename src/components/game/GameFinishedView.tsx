'use client';

import { useState, useEffect } from 'react';
import Leaderboard from '../Leaderboard';

type Props = {
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

/**
 * GameFinishedView - Displays when game is FINISHED
 * 
 * Shows the leaderboard and countdown to the next game cycle.
 */
export default function GameFinishedView({ gameState, onLogout }: Props) {
  const [nextGameCountdown, setNextGameCountdown] = useState(0);

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
      <div className="text-center">
        <h2 className="hero-title text-3xl md:text-4xl font-black text-stroke mb-2">
          Game Over!
        </h2>
        <p className="text-gray-400 text-sm">
          Check your accuracy and speed on the leaderboard
        </p>
      </div>

      <Leaderboard />

      {nextGameCountdown > 0 && (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 text-center backdrop-blur-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Next game in</p>
          <div className="text-3xl font-black text-white mb-4">
            {formatCountdown(nextGameCountdown)}
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-gray-300 hover:text-gray-200 transition-colors"
          >
            ← Return to home
          </button>
        </div>
      )}
    </div>
  );
}
