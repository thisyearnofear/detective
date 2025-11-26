'use client';

import { useState, useEffect } from 'react';
import { GameCycleState } from '@/lib/types';

type Props = {
  gameState: {
    state: GameCycleState;
    playerCount: number;
    registrationEnds: number;
    gameEnds: number;
  };
};

/**
 * GameStatusCard - Dynamic pre-auth status display
 * 
 * Shows users what's happening in the game right now:
 * - REGISTRATION: countdown + player count
 * - LIVE: active players + time remaining
 * - FINISHED: leaderboard ready + next round countdown
 */
export default function GameStatusCard({ gameState }: Props) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update timer based on game state
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      let remaining = 0;

      if (gameState.state === 'REGISTRATION') {
        remaining = Math.max(0, gameState.registrationEnds - now);
      } else if (gameState.state === 'LIVE') {
        remaining = Math.max(0, gameState.gameEnds - now);
      } else if (gameState.state === 'FINISHED') {
        // Estimate next registration (5 second grace period)
        remaining = Math.max(0, gameState.gameEnds + 5000 - now);
      }

      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState.state, gameState.registrationEnds, gameState.gameEnds]);

  if (!mounted) return null;

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // REGISTRATION - Show countdown and opportunity to join
  if (gameState.state === 'REGISTRATION') {
    const maxPlayers = 8;
    const progress = Math.min(100, (gameState.playerCount / maxPlayers) * 100);
    const isReadyToStart = gameState.playerCount >= 4;

    return (
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⏱️</span>
                <h3 className="hero-title text-xl font-black text-stroke">Registration Open</h3>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                Join now and compete against real players and AI opponents
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-400 bg-green-500/10 border border-green-500/30 rounded px-3 py-1">
                Join Now
              </div>
            </div>
          </div>

          {/* Player Count Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{gameState.playerCount} / {maxPlayers} players registered</span>
              {isReadyToStart && <span className="text-green-400 font-bold">Ready to start soon!</span>}
            </div>
            <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${isReadyToStart ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>


        </div>
      </div>
    );
  }

  // LIVE - Show active game with player count and time
  if (gameState.state === 'LIVE') {
    return (
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎮</span>
              <h3 className="hero-title text-xl font-black text-stroke">Game Live</h3>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              {gameState.playerCount} players are competing right now
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-gray-400">Time remaining</span>
              <span className="text-2xl font-black text-purple-300">{formatTime(timeLeft)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Next registration opens after game ends</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-purple-300">Live</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FINISHED - Show leaderboard available and countdown to next
  if (gameState.state === 'FINISHED') {
    return (
      <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
              <h3 className="hero-title text-xl font-black text-stroke">Game Finished</h3>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              View the leaderboard and see who won
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-gray-400">Next round in</span>
              <span className="text-2xl font-black text-amber-300">{formatTime(timeLeft)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Registration will reopen shortly</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-1">
              View Results
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
