'use client';

import { useEffect, useState } from 'react';
import { GameCycleState } from '@/lib/types';

type Props = {
  gameState: {
    state: GameCycleState;
    playerCount: number;
    registrationEnds: number;
    gameEnds: number;
    finishedAt?: number;
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
        // Calculate when registration reopens (5 second grace period after finish)
        const nextRegistration = (gameState.finishedAt || now) + 5000;
        remaining = Math.max(0, nextRegistration - now);
      }

      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState.state, gameState.registrationEnds, gameState.gameEnds, gameState.finishedAt]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // REGISTRATION - Show countdown and opportunity to join
  if (gameState.state === 'REGISTRATION') {
    const maxPlayers = 8;
    const MIN_PLAYERS = 3;
    const progress = Math.min(100, (gameState.playerCount / maxPlayers) * 100);
    const hasMinPlayers = gameState.playerCount >= MIN_PLAYERS;
    const countdownActive = hasMinPlayers && timeLeft < 999999999;

    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-blue-900/30 to-purple-900/30 border-2 border-emerald-500/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-400/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl">⏱️</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Registration Open</h3>
                <p className="text-sm text-emerald-300/90 font-medium">
                  {!hasMinPlayers ? 'Waiting for players...' : countdownActive ? 'Starting soon!' : 'Ready to start'}
                </p>
              </div>
            </div>
            <div className="status-badge open">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span>Open</span>
            </div>
          </div>

          {/* Player Count */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">{gameState.playerCount} <span className="text-base text-gray-400 font-normal">/ {maxPlayers}</span></span>
              {!hasMinPlayers && (
                <span className="chip text-xs px-3 py-1 bg-gray-700/50 text-gray-300">
                  {MIN_PLAYERS - gameState.playerCount} more needed
                </span>
              )}
              {hasMinPlayers && countdownActive && (
                <span className="chip active text-xs px-3 py-1 animate-pulse">
                  🚀 {Math.floor(timeLeft / 1000)}s
                </span>
              )}
            </div>
            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/20">
              <div
                className={`h-full transition-all duration-700 ease-out ${hasMinPlayers ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-blue-400 to-purple-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-300 font-medium">
              {!hasMinPlayers ? `Need ${MIN_PLAYERS} players to start` : 'players registered'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // LIVE - Show active game with player count and time
  if (gameState.state === 'LIVE') {
    return (
      <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-fuchsia-900/30 border-2 border-purple-500/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 border-2 border-purple-400/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl">🎮</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Game Live</h3>
                <p className="text-sm text-purple-300/90 font-medium">{gameState.playerCount} players competing</p>
              </div>
            </div>
            <div className="status-badge live">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              <span>Live</span>
            </div>
          </div>

          {/* Timer */}
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium uppercase tracking-wider">Time Remaining</p>
            <div className="text-4xl font-black text-white tracking-tight">
              {formatTime(timeLeft)}
            </div>
            <p className="text-xs text-gray-400 font-medium">Next registration opens after game ends</p>
          </div>
        </div>
      </div>
    );
  }

  // FINISHED - Show leaderboard available and countdown to next
  if (gameState.state === 'FINISHED') {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 via-orange-900/30 to-yellow-900/30 border-2 border-amber-500/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 border-2 border-amber-400/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Game Finished</h3>
                <p className="text-sm text-amber-300/90 font-medium">View results & leaderboard</p>
              </div>
            </div>
            <div className="status-badge finished">
              <span>Finished</span>
            </div>
          </div>

          {/* Next Round Timer */}
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium uppercase tracking-wider">Next Round In</p>
            <div className="text-4xl font-black text-white tracking-tight">
              {formatTime(timeLeft)}
            </div>
            <p className="text-xs text-gray-400 font-medium">Registration will reopen shortly</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
