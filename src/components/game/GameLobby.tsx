'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player, UserProfile } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GameLobby({ currentPlayer, isRegistrationOpen = true, gameState }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(gameState?.isRegistered || false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('REGISTRATION');
  const [timeLeft, setTimeLeft] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState('');

  // Fetch registered players list
  const { data: playersData } = useSWR(
    '/api/game/players',
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    }
  );

  // Poll server for phase transitions (server-driven, not client-side setTimeout)
  const { data: phaseData, error: phaseError } = useSWR(
    gameState?.cycleId ? `/api/game/phase?cycleId=${gameState.cycleId}&fid=${currentPlayer.fid}` : null,
    fetcher,
    {
      refreshInterval: 2000, // Poll every 2s for phase changes (UI countdown keeps it smooth via useCountdown)
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryInterval: 1000,
    }
  );

  const registeredPlayers = (playersData?.players || []) as Player[];
  const maxPlayers = 8;

  // Sync phase from server response (not from client logic)
  useEffect(() => {
    if (phaseData?.phase) {
      // Map server phase to component phase
      const serverPhase = phaseData.phase as string;
      
      if (gamePhase === 'REGISTRATION' && serverPhase === 'BOT_GENERATION') {
        // Server says transition to bot generation
        setGamePhase('BOT_GENERATION');
        setPhaseMessage(phaseData.reason);
      }
      
      setPhaseMessage(phaseData.reason || '');
    }
  }, [phaseData?.phase, gamePhase]);

  // Use countdown hook for timer (syncs with server)
  const countdownEndTime = phaseData?.phaseEndTime || gameState?.registrationEnds || 0;
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

  // Show error if phase endpoint failed
  if (phaseError && gamePhase === 'REGISTRATION') {
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
          phaseMessage={phaseMessage}
        />
      );
  }
}
