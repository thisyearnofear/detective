'use client';

import { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import MobileAppContainer from './MobileAppContainer';
import MultiChatContainer from './MultiChatContainer';

type Props = {
  fid: number;
  gameState: any;
  sdkUser: any;
};

export default function MobileGameWrapper({ fid, gameState, sdkUser }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [votes, setVotes] = useState<Record<string, 'REAL' | 'BOT'>>({});
  // Using a constant since state is not modified
  const matchData = null as { matches?: any[]; currentRound?: number; totalRounds?: number; cycleId?: string; playerPool?: any } | null;

  // Detect mobile using media query
  useMediaQuery({ maxWidth: 768 }, undefined, (matches) => {
    setIsMobile(matches);
  });

  // For SSR safety, detect mobile on client side
  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  // Mock match data and handlers for mobile demo
  // In real implementation, this would come from the actual game state
  const handleVoteToggle = (matchId: string) => {
    setVotes(prev => ({
      ...prev,
      [matchId]: prev[matchId] === 'REAL' ? 'BOT' : 'REAL'
    }));
  };

  const handleMatchComplete = (matchId: string) => {
    console.log('Match completed:', matchId);
  };

  const handleQuickMatch = () => {
    console.log('Quick match requested');
  };

  const handleChallengePlayer = (targetFid: number) => {
    console.log('Challenge player:', targetFid);
  };

  // If mobile, use optimized mobile container
  if (isMobile) {
    return (
      <MobileAppContainer
        fid={fid}
        gameState={gameState}
        sdkUser={sdkUser}
        matches={matchData ? matchData.matches || [] : []}
        currentVotes={votes}
        onVoteToggle={handleVoteToggle}
        onMatchComplete={handleMatchComplete}
        currentRound={matchData?.currentRound || 1}
        totalRounds={matchData?.totalRounds || 5}
        cycleId={matchData?.cycleId || ''}
        playerCount={matchData?.playerPool?.totalPlayers || 0}
        activeMatchIds={matchData ? matchData.matches?.map((m: any) => m.id) || [] : []}
        onQuickMatch={handleQuickMatch}
        onChallengePlayer={handleChallengePlayer}
      />
    );
  }

  // Desktop: use existing MultiChatContainer
  return <MultiChatContainer fid={fid} />;
}