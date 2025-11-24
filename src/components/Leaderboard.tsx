'use client';

import useSWR from 'swr';
import { LeaderboardEntry } from '@/lib/types';
import Image from 'next/image';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const getRankColor = (rank: number) => {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-yellow-600';
  return 'text-gray-500';
};

export default function Leaderboard() {
  const { data: leaderboard, error } = useSWR<LeaderboardEntry[]>('/api/leaderboard/current', fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
  });

  if (error) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-red-400">Failed to load leaderboard.</div>;
  }

  if (!leaderboard) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-gray-400">Loading Leaderboard...</div>;
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 mt-8">
        <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
        <p className="text-gray-400 text-center">No scores recorded yet. Play a match to get on the board!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 mt-8">
      <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-slate-700">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-0">Rank</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Player</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {leaderboard.map((entry, index) => (
                  <tr key={entry.player.fid}>
                    <td className={`whitespace-nowrap py-4 pl-4 pr-3 text-lg font-bold sm:pl-0 ${getRankColor(index + 1)}`}>
                      #{index + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <Image className="h-10 w-10 rounded-full" src={entry.player.pfpUrl} alt="" width={40} height={40} />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-white">{entry.player.displayName}</div>
                          <div className="text-gray-500">@{entry.player.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-lg font-semibold text-white">{entry.accuracy.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

