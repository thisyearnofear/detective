'use client';

import { useEffect } from 'react';
import { sendGameStartNotification } from '@/lib/farcasterAuth';

type Props = {
  gameState: any;
  playerName?: string;
};

export default function GameStartNotification({ gameState, playerName }: Props) {
  useEffect(() => {
    // Send notification when game transitions to LIVE
    if (gameState?.state === 'LIVE' && playerName) {
      const message = `Your Detective game is starting! Good luck, ${playerName}! 🔍`;
      sendGameStartNotification(message).catch(console.warn);
    }
  }, [gameState?.state, playerName]);

  return null; // This is a utility component with no UI
}