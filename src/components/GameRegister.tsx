'use client';

import { useState } from 'react';
import { Player } from '@/lib/types';
import RegistrationLoader from './RegistrationLoader';

type Props = {
  fid: number;
  // This will be passed down from a parent component that fetches the game state
  isRegistrationOpen: boolean;
};

export default function GameRegister({ fid, isRegistrationOpen }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredPlayer, setRegisteredPlayer] = useState<Player | null>(null);

  // Don't render the component if registration is not open
  if (!isRegistrationOpen) {
    return null;
  }

  // If player is already registered, show a success message
  if (registeredPlayer) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-green-500">
        <p className="text-center text-green-400 font-semibold">
          You are registered for this game cycle!
        </p>
      </div>
    );
  }

  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/game/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }

      setRegisteredPlayer(data.player);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <RegistrationLoader isVisible={isLoading} />
      <div className="bg-slate-800 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Join the Game</h2>
            <p className="text-sm text-gray-400">
              Register now to participate in the current cycle.
            </p>
          </div>
          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            onClick={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </div>
        {error && <div className="mt-4 text-sm text-red-400 text-center">{error}</div>}
      </div>
    </>
  );
}

