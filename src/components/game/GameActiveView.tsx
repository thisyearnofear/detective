'use client';

import MultiChatContainer from '../MultiChatContainer';

type Props = {
  fid: number;
  cycleId: string;
};

/**
 * GameActiveView - Displays during LIVE game state
 * 
 * Renders the main multiplayer chat interface where players
 * compete against real players and AI bots.
 */
export default function GameActiveView({ fid, cycleId }: Props) {
  return <MultiChatContainer key={cycleId || 'live-game'} fid={fid} />;
}
