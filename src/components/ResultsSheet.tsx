'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Leaderboard from './Leaderboard';
import { fetcher } from '@/lib/fetcher';

type Props = {
  fid: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function ResultsSheet({ fid, isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'results' | 'leaderboard'>('results');

  // Fetch player stats
  const { data: statsData } = useSWR(
    isOpen && fid ? `/api/stats/player/${fid}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const playerStats = statsData?.stats || {
    total_games: 0,
    accuracy: 0,
    avg_speed_ms: 0,
    rank: 0,
    total_players: 0,
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950 rounded-t-3xl border-t border-white/10 z-50 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Handle + Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-white/5">
          {/* Drag Handle */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('results')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all text-sm ${
                tab === 'results'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              📊 Your Results
            </button>
            <button
              onClick={() => setTab('leaderboard')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all text-sm ${
                tab === 'leaderboard'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              🏆 Leaderboard
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'results' && (
            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="space-y-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
                  This Game
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-2xl font-black text-yellow-400">
                      {playerStats.accuracy ? playerStats.accuracy.toFixed(0) : 0}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Accuracy</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-2xl font-black text-blue-400">
                      #{playerStats.rank || '-'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      of {playerStats.total_players || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Career Stats */}
              <div className="space-y-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
                  Your Career
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-2xl font-black text-white">
                      {playerStats.total_games}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Total Games</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-2xl font-black text-green-400">
                      {playerStats.avg_speed_ms}ms
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Avg Speed</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center pt-4">
                Play more games to improve your rank
              </p>
            </div>
          )}

          {tab === 'leaderboard' && (
            <div className="p-6">
              <Leaderboard />
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="px-6 pb-6 pt-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-semibold transition-all text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
