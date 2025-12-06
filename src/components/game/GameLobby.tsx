'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player, UserProfile } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';
import { fetcher } from '@/lib/fetcher';
import BotGeneration from './phases/BotGeneration';
import PlayerReveal from './phases/PlayerReveal';
import GameCountdown from './phases/GameCountdown';
import Lobby from './phases/Lobby';
import ErrorCard from '../ErrorCard';

type GamePhase = 'REGISTRATION' | 'BOT_GENERATION' | 'PLAYER_REVEAL' | 'COUNTDOWN' | 'LIVE' | 'ERROR';

type Props = {
  currentPlayer: UserProfile;
  isRegistrationOpen?: boolean;
  gameState: any;
};

export default function GameLobby({ currentPlayer, isRegistrationOpen = true, gameState }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(gameState?.isRegistered || false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('REGISTRATION');
  const [timeLeft, setTimeLeft] = useState(0);

  // Consolidated polling: single endpoint for game state, phase, and players
  // Reduces 2 requests/2s to 1 request/2s
  const { data: statusData } = useSWR(
    gameState?.cycleId ? `/api/game/status?cycleId=${gameState.cycleId}&fid=${currentPlayer.fid}` : null,
    fetcher,
    {
      refreshInterval: 2000, // Poll every 2s for phase changes + player updates
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryInterval: 1000,
    }
  );

  const registeredPlayers = (statusData?.players || []) as Player[];
  const maxPlayers = 8;

  // Sync phase from consolidated server response (not from client logic)
  useEffect(() => {
    if (statusData?.phase) {
      const serverPhase = statusData.phase as string;
      
      if (gamePhase === 'REGISTRATION' && serverPhase === 'BOT_GENERATION') {
        setGamePhase('BOT_GENERATION');
      }
    }
  }, [statusData?.phase, gamePhase]);

  // Use countdown hook for timer (syncs with server)
  const countdownEndTime = statusData?.phaseEndTime || gameState?.registrationEnds || 0;
  const { timeRemaining } = useCountdown({
    endTime: countdownEndTime,
    pollInterval: 100, // Smooth updates
  });

  // Update timeLeft state for Lobby component
  useEffect(() => {
    setTimeLeft(timeRemaining);
  }, [timeRemaining]);

  const handleRegister = async () => {
    console.log('handleRegister called for FID:', currentPlayer.fid); // Debug log
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/game/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ fid: currentPlayer.fid }),
        signal: AbortSignal.timeout(10000), // 10s timeout for mobile
      });

      console.log('Registration response status:', response.status); // Debug log

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Registration error response:', errorText); // Debug log
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      console.log('Registration success:', data); // Debug log
      setIsRegistered(true);
    } catch (err: any) {
      console.error('Registration error:', err); // Debug log
      setError(err.name === 'TimeoutError' ? 'Registration timed out. Please try again.' : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReady = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/game/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: currentPlayer.fid }),
      });

      if (!response.ok) {
        throw new Error('Failed to set ready status');
      }

      // Optimistic update or wait for SWR revalidation
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGameStart = () => {
    console.log('Game starting with players:', registeredPlayers);
  };

  if (!isRegistrationOpen) {
    return null;
  }

  // Show error if status endpoint failed
  if (error && gamePhase === 'REGISTRATION') {
    return (
      <ErrorCard
        title="Game Connection Lost"
        message="Unable to connect to game server. Please refresh."
        severity="error"
        icon="🔌"
        onDismiss={() => window.location.reload()}
      />
    );
  }

  // Phase Rendering - server-driven
  switch (gamePhase) {
    case 'BOT_GENERATION':
      return (
        <BotGeneration
          playerCount={registeredPlayers.length}
          onComplete={() => setGamePhase('PLAYER_REVEAL')}
        />
      );

    case 'PLAYER_REVEAL':
      return (
        <PlayerReveal
          players={registeredPlayers}
          onComplete={() => setGamePhase('COUNTDOWN')}
        />
      );

    case 'COUNTDOWN':
      return (
        <GameCountdown
          playerCount={registeredPlayers.length}
          onComplete={() => {
            setGamePhase('LIVE');
            handleGameStart();
          }}
        />
      );

    case 'REGISTRATION':
    default:
      return (
        <Lobby
          currentPlayer={currentPlayer}
          registeredPlayers={registeredPlayers}
          maxPlayers={maxPlayers}
          timeLeft={timeLeft}
          isRegistered={isRegistered}
          isLoading={isLoading}
          error={error}
          onRegister={handleRegister}
          onReady={handleReady}
        />
      );
  }
}
