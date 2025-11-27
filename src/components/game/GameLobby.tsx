'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player, UserProfile } from '@/lib/types';
import { prewarmAblyConnection } from '@/lib/connectionPrewarm';
import BotGeneration from './phases/BotGeneration';
import PlayerReveal from './phases/PlayerReveal';
import GameCountdown from './phases/GameCountdown';
import Lobby from './phases/Lobby';

type GamePhase = 'lobby' | 'bot_generation' | 'player_reveal' | 'countdown' | 'live';

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
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');
  const [timeLeft, setTimeLeft] = useState(0);

  // Fetch registered players list
  const { data: playersData } = useSWR(
    '/api/game/players',
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    }
  );

  const registeredPlayers = (playersData?.players || []) as Player[];
  const maxPlayers = 8;

  // Countdown timer for registration
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, (gameState?.registrationEnds || Date.now() + 300000) - now);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState?.registrationEnds]);

  // Check if game should start (when lobby is full or registration ends)
  useEffect(() => {
    const isFull = registeredPlayers.length >= maxPlayers;
    const isTimeUp = gameState?.registrationEnds && Date.now() > gameState.registrationEnds;

    if ((isFull || isTimeUp) && registeredPlayers.length >= 3 && gamePhase === 'lobby') {
      // Need minimum 3 players to start, transition to game start
      const timer = setTimeout(() => {
        setGamePhase('bot_generation');
      }, 2000); // 2 second delay before starting sequence

      return () => clearTimeout(timer);
    }
  }, [registeredPlayers.length, gameState?.registrationEnds, maxPlayers, gamePhase]);

  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/game/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: currentPlayer.fid }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }

      setIsRegistered(true);
    } catch (err: any) {
      setError(err.message);
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
    // Prewarm Ably connection for all registered players
    registeredPlayers.forEach(player => {
      prewarmAblyConnection(player.fid)
        .catch(err => console.warn(`Failed to prewarm for FID ${player.fid}:`, err));
    });
    
    // This will trigger the main game flow
    // The parent component should handle the transition to LIVE state
    console.log('Game starting with players:', registeredPlayers);
  };

  if (!isRegistrationOpen) {
    return null;
  }

  // Phase Rendering
  switch (gamePhase) {
    case 'bot_generation':
      return (
        <BotGeneration
          playerCount={registeredPlayers.length}
          onComplete={() => setGamePhase('player_reveal')}
        />
      );

    case 'player_reveal':
      return (
        <PlayerReveal
          players={registeredPlayers}
          onComplete={() => setGamePhase('countdown')}
        />
      );

    case 'countdown':
      return (
        <GameCountdown
          playerCount={registeredPlayers.length}
          onComplete={() => {
            setGamePhase('live');
            handleGameStart();
          }}
        />
      );

    case 'lobby':
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
