'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player } from '@/lib/types';
import SpinningDetective from '../SpinningDetective';
import RegistrationLoader from '../RegistrationLoader';

type GamePhase = 'lobby' | 'bot_generation' | 'player_reveal' | 'countdown';

type Props = {
  currentPlayer: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  };
  gameState: {
    cycleId: string;
    state: string;
    playerCount: number;
    registrationEnds: number;
    gameEnds: number;
    isRegistered: boolean;
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GameLobby({ currentPlayer, gameState }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(gameState?.isRegistered || false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');

  // Game start sequence states
  const [botProgress, setBotProgress] = useState(0);
  const [countdown, setCountdown] = useState(5);

  // Fetch registered players list
  const { data: playersData } = useSWR(
    '/api/game/players',
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    }
  );

  const registeredPlayers = playersData?.players || [];
  const maxPlayers = 8;
  const spotsLeft = maxPlayers - registeredPlayers.length;
  const isFull = spotsLeft === 0;
  const [timeLeft, setTimeLeft] = useState(0);

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

  // Check if game should start
  useEffect(() => {
    const isFull = registeredPlayers.length >= maxPlayers;
    const isTimeUp = gameState?.registrationEnds && Date.now() > gameState.registrationEnds;

    if ((isFull || isTimeUp) && registeredPlayers.length >= 3 && gamePhase === 'lobby') {
      const timer = setTimeout(() => {
        setGamePhase('bot_generation');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [registeredPlayers.length, gameState?.registrationEnds, gamePhase]);

  // Simulate bot generation progress
  useEffect(() => {
    if (gamePhase !== 'bot_generation') return;

    const interval = setInterval(() => {
      setBotProgress((prev) => {
        const newProgress = prev + Math.random() * 15 + 5;
        if (newProgress >= 100) {
          setTimeout(() => setGamePhase('player_reveal'), 500);
          return 100;
        }
        return newProgress;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [gamePhase]);

  // Player reveal sequence
  useEffect(() => {
    if (gamePhase !== 'player_reveal') return;

    const timer = setTimeout(() => {
      setGamePhase('countdown');
    }, 3000);

    return () => clearTimeout(timer);
  }, [gamePhase]);

  // Final countdown
  useEffect(() => {
    if (gamePhase !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gamePhase]);

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

  const formatTimeLeft = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Bot generation phase
  if (gamePhase === 'bot_generation') {
    return (
      <div className="text-center space-y-6 md:space-y-8">
        <div className="space-y-3 md:space-y-4">
          <SpinningDetective size="xl" className="mx-auto" />
          <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke">
            Generating AI Opponents
          </h2>
          <p className="text-gray-400 text-xs md:text-sm px-4">
            Creating unique AI personas based on player profiles...
          </p>
        </div>

        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <span className="text-xs md:text-sm font-medium text-white">Bot Generation</span>
            <span className="text-xs md:text-sm font-bold text-blue-400">{Math.round(botProgress)}%</span>
          </div>
          <div className="w-full bg-slate-700/50 h-2 md:h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-200"
              style={{ width: `${botProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-3 md:mt-4">
            Analyzing {registeredPlayers.length} players · Creating {registeredPlayers.length} AI opponents
          </p>
        </div>
      </div>
    );
  }

  // Player reveal phase
  if (gamePhase === 'player_reveal') {
    return (
      <div className="text-center space-y-6 md:space-y-8">
        <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke">
          Meet Your Opponents
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {registeredPlayers.map((player: Player) => (
            <div
              key={player.fid}
              className="bg-slate-900/50 border border-white/10 rounded-lg p-3 md:p-4 text-center animate-fade-in backdrop-blur-sm"
            >
              <div className="text-3xl md:text-4xl mb-2 md:mb-3">👤</div>
              <div className="text-sm md:text-base font-bold text-white truncate">
                @{player.username}
              </div>
              <div className="text-xs text-gray-400 mt-1">Real Player</div>
            </div>
          ))}

          {registeredPlayers.map((_: Player, idx: number) => (
            <div
              key={`bot-${idx}`}
              className="bg-slate-900/50 border border-purple-500/30 rounded-lg p-3 md:p-4 text-center animate-fade-in backdrop-blur-sm"
            >
              <div className="text-3xl md:text-4xl mb-2 md:mb-3">🤖</div>
              <div className="text-sm md:text-base font-bold text-purple-300">AI Bot {idx + 1}</div>
              <div className="text-xs text-gray-400 mt-1">AI Opponent</div>
            </div>
          ))}
        </div>

        <p className="text-xs md:text-sm text-gray-400">Get ready for simultaneous matches...</p>
      </div>
    );
  }

  // Countdown phase
  if (gamePhase === 'countdown') {
    return (
      <div className="text-center space-y-6 md:space-y-8 flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px]">
        <p className="text-gray-400 text-xs md:text-sm">Game starts in</p>
        <div className="text-7xl md:text-9xl font-black text-white animate-bounce">
          {countdown}
        </div>
        <div className="space-y-2 text-center">
          <p className="text-gray-400 text-xs md:text-sm">Prepare yourself...</p>
          <p className="text-xs text-gray-500">
            You'll manage {registeredPlayers.length} simultaneous conversations
          </p>
        </div>
      </div>
    );
  }

  // Lobby phase - registration interface
  return (
    <div className="space-y-6">
      <RegistrationLoader isVisible={isLoading} />

      <div className="text-center">
        <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke mb-2">
          Game Lobby
        </h2>
        <p className="text-gray-400 text-xs md:text-sm">
          {isFull ? 'Lobby is full!' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`}
        </p>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <span className="text-xs md:text-sm font-medium text-white">Players Registered</span>
          <span className="text-xs md:text-sm font-bold text-blue-400">
            {registeredPlayers.length}/{maxPlayers}
          </span>
        </div>
        <div className="w-full bg-slate-700/50 h-2 md:h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${(registeredPlayers.length / maxPlayers) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 text-center backdrop-blur-sm">
        <span className="text-xs text-gray-400 uppercase tracking-wide">Time Remaining</span>
        <div className="text-4xl md:text-5xl font-black text-white mt-2">
          {formatTimeLeft(timeLeft)}
        </div>
      </div>

      {registeredPlayers.length > 0 && (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
          <h3 className="font-bold text-white mb-4 text-sm md:text-base">Registered Players</h3>
          <div className="space-y-2">
            {registeredPlayers.map((player: Player) => (
              <div
                key={player.fid}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {player.username.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">@{player.username}</div>
                    <div className="text-xs text-gray-500">{player.displayName}</div>
                  </div>
                </div>
                {player.fid === currentPlayer.fid && (
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                    You
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isRegistered ? (
        <button
          onClick={handleRegister}
          disabled={isLoading || isFull}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm md:text-base"
        >
          {isLoading ? 'Registering...' : isFull ? 'Lobby Full' : 'Register for Game'}
        </button>
      ) : (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center text-green-300 text-sm">
          ✅ You're registered! Waiting for game to start...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-200 text-sm text-center backdrop-blur-sm">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
