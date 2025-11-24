'use client';

import { useEffect, useState } from 'react';

type Status = {
  active: boolean;
  cycleId?: string;
  name?: string;
  players?: number;
  maxPlayers?: number;
  matches?: number;
};

export default function GameStatus() {
  const [status, setStatus] = useState<Status>({ active: false });

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('/api/game/status').then((r) => r.json());
      setStatus(res);
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-slate-800 rounded-lg p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">Game Status</h2>
      {status.active ? (
        <div className="space-y-2 text-sm">
          <div className="text-gray-400">Cycle: {status.name} ({status.cycleId})</div>
          <div className="text-gray-400">Players: {status.players}/{status.maxPlayers}</div>
          <div className="text-gray-400">Active Matches: {status.matches}</div>
        </div>
      ) : (
        <div className="text-gray-400">No active cycle. Register to start a new one.</div>
      )}
    </div>
  );
}

