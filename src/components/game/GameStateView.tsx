'use client';

import { useEffect } from 'react';
import { GameCycleState } from '@/lib/types';
import { sendGameStartNotification } from '@/lib/farcasterAuth';
import GameLobby from './GameLobby';
import GameActiveView from './GameActiveView';
import GameFinishedView from './GameFinishedView';

type Props = {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  gameState: {
    cycleId: string;
    state: GameCycleState;
    playerCount: number;
    registrationEnds: number;
    gameEnds: number;
    isRegistered: boolean;
  };
};

/**
 * GameStateView - Unified orchestrator for all game states
 * 
 * Responsibilities:
 * - Routes between REGISTRATION, LIVE, and FINISHED states
 * - Handles game start notifications
 * - Manages player context throughout game lifecycle
 * - Clean single source of truth for game state logic
 */
export default function GameStateView({
  fid,
  username,
  displayName,
  pfpUrl,
  gameState,
}: Props) {
  const currentPlayer = { fid, username, displayName, pfpUrl };

  // Send notification when game transitions to LIVE
  useEffect(() => {
    if (gameState?.state === 'LIVE') {
      const message = `Your Detective game is starting! Good luck, ${username}! 🔍`;
      sendGameStartNotification(message).catch(console.warn);
    }
  }, [gameState?.state, username]);

  // State machine: Route to appropriate view based on game state
  switch (gameState.state as GameCycleState) {
    case 'REGISTRATION':
      return (
        <GameLobby
          currentPlayer={currentPlayer}
          gameState={gameState}
        />
      );

    case 'LIVE':
      // Player missed registration window
      if (!gameState.isRegistered) {
        return (
          <div className="w-full space-y-6 text-center py-8">
            <div className="text-6xl mb-4">⏰</div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Game in Progress</h2>
              <p className="text-gray-400 text-sm">
                Registration opens when this game ends
              </p>
            </div>
          </div>
        );
      }
      return (
        <GameActiveView
          fid={fid}
          cycleId={gameState.cycleId}
        />
      );

    case 'FINISHED':
      return <GameFinishedView />;

    default:
      return null;
  }
}
