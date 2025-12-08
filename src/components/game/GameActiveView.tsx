'use client';

import MultiChatContainer from '../MultiChatContainer';

type GameResults = {
  accuracy: number;
  roundResults: Array<{ roundNumber: number; correct: boolean; opponentUsername: string; opponentType: "REAL" | "BOT" }>;
  playerRank: number;
  totalPlayers: number;
};

type Props = {
  fid: number;
  cycleId: string;
  onGameFinish?: (results: GameResults) => void;
};

/**
 * GameActiveView - Displays during LIVE game state
 * 
 * Renders the main multiplayer chat interface where players
 * compete against real players and AI bots.
 */
export default function GameActiveView({ fid, cycleId, onGameFinish }: Props) {
  return <MultiChatContainer key={cycleId || 'live-game'} fid={fid} onGameFinish={onGameFinish} />;
}
