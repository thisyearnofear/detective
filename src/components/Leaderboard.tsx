'use client';

import { useEffect, useState } from 'react';

type Entry = {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  accuracy: number;
  correctGuesses: number;
  totalGuesses: number;
  rank: number;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const fetchEntries = async () => {
      const res = await fetch('/api/leaderboard/current').then((r) => r.json());
      setEntries(res.entries || []);
    };
    fetchEntries();
    const id = setInterval(fetchEntries, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card mt-8">
      <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
      {entries.length === 0 ? (
        <div className="text-gray-400 text-sm">No entries yet.</div>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 10).map((e) => (
            <div key={e.fid} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                {e.pfpUrl && (
                  <img src={e.pfpUrl} alt="pfp" className="w-6 h-6 rounded-full" />
                )}
                <div>
                  <div className="font-semibold">@{e.username}{e.displayName ? ` (${e.displayName})` : ''}</div>
                  <div className="text-gray-500">{e.correctGuesses}/{e.totalGuesses} correct</div>
                </div>
              </div>
              <div className="text-gray-300">{e.accuracy.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

