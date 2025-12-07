'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player, UserProfile } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';
import { fetcher } from '@/lib/fetcher';
import Lobby from './phases/Lobby';
import ErrorCard from '../ErrorCard';

type Props = {
  currentPlayer: UserProfile;
  isRegistrationOpen?: boolean;
  gameState: any;
};

export default function GameLobby({ currentPlayer, isRegistrationOpen = true, gameState }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(gameState?.isRegistered || false);
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
  if (error) {
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

  // Only show Lobby during REGISTRATION - parent GameStateView will switch to GameActiveView when LIVE
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
