'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { LeaderboardEntry } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ViewMode = 'personal' | 'top' | 'nearby' | 'friends';
type ChainFilter = 'arbitrum' | 'monad' | 'cross-chain';

interface MobileLeaderboardData {
  personal: {
    rank: number;
    percentile: number;
    recentChange: number;
    nextMilestone: string;
  };
  entries: LeaderboardEntry[];
  chainStats: any;
}

export default function MobileLeaderboardOptimized({ 
  fid, 
  onChallengePlayer,
  onQuickMatch 
}: { 
  fid: number;
  onChallengePlayer?: (targetFid: number) => void;
  onQuickMatch?: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('personal');
  const [chainFilter, setChainFilter] = useState<ChainFilter>('arbitrum');
  const [refreshing, setRefreshing] = useState(false);
  const [showPersonalCard, setShowPersonalCard] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, mutate } = useSWR<MobileLeaderboardData>(
    `/api/leaderboard/mobile?fid=${fid}&mode=${viewMode}&chain=${chainFilter}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  // Pull to refresh implementation
  const handleRefresh = async () => {
    setRefreshing(true);
    await mutate();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Auto-scroll to user's position in 'nearby' mode
  useEffect(() => {
    if (viewMode === 'nearby' && data?.personal && scrollRef.current) {
      const userIndex = data.entries.findIndex(entry => entry.player.fid === fid);
      if (userIndex >= 0) {
        const element = scrollRef.current.children[userIndex] as HTMLElement;
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [viewMode, data, fid]);

  const getViewModeTitle = (mode: ViewMode) => {
    switch (mode) {
      case 'personal': return 'Your Performance';
      case 'top': return 'Elite Detectives';
      case 'nearby': return 'Your Competition';
      case 'friends': return 'Friends & Rivals';
      default: return 'Rankings';
    }
  };

  const getChainIcon = (chain: ChainFilter) => {
    switch (chain) {
      case 'arbitrum': return '🔷';
      case 'monad': return '🟣';
      case 'cross-chain': return '🌐';
      default: return '🏆';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {/* Loading skeleton optimized for mobile */}
        <div className="bg-slate-900/50 rounded-xl p-4 animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-32 mb-3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-700 rounded w-24"></div>
            <div className="h-8 bg-slate-700 rounded w-16"></div>
          </div>
        </div>
        
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-900/50 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-20"></div>
                <div className="h-3 bg-slate-700 rounded w-16"></div>
              </div>
              <div className="h-6 bg-slate-700 rounded w-12"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/50">
      {/* Header with filters - sticky on mobile */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-lg border-b border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {getViewModeTitle(viewMode)}
          </h2>
          
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-lg bg-slate-800/50 text-gray-400 hover:text-white transition-all ${refreshing ? 'animate-spin' : ''}`}
            >
              <span className="text-sm">🔄</span>
            </button>
            
            {onQuickMatch && (
              <button
                onClick={onQuickMatch}
                className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Quick Match
              </button>
            )}
          </div>
        </div>

        {/* Chain filter */}
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          {(['arbitrum', 'monad', 'cross-chain'] as ChainFilter[]).map((chain) => (
            <button
              key={chain}
              onClick={() => setChainFilter(chain)}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs rounded transition-colors ${
                chainFilter === chain
                  ? 'bg-slate-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>{getChainIcon(chain)}</span>
              <span className="capitalize">{chain.replace('-', ' ')}</span>
            </button>
          ))}
        </div>

        {/* View mode selector */}
        <div className="flex gap-1 bg-slate-800/30 rounded-lg p-1">
          {(['personal', 'top', 'nearby', 'friends'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 px-2 py-2 text-xs rounded transition-colors ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode === 'personal' ? 'You' : 
               mode === 'top' ? 'Top' :
               mode === 'nearby' ? 'Nearby' : 'Friends'}
            </button>
          ))}
        </div>
      </div>

      {/* Personal performance card */}
      {viewMode === 'personal' && data?.personal && (
        <AnimatePresence>
          {showPersonalCard && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="m-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Your Stats</h3>
                <button
                  onClick={() => setShowPersonalCard(false)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">#{data.personal.rank}</div>
                  <div className="text-xs text-gray-400">Current Rank</div>
                  {data.personal.recentChange !== 0 && (
                    <div className={`text-xs ${data.personal.recentChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.personal.recentChange > 0 ? '↗' : '↘'} {Math.abs(data.personal.recentChange)} spots
                    </div>
                  )}
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{data.personal.percentile}%</div>
                  <div className="text-xs text-gray-400">Top Percentile</div>
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Next Milestone</div>
                <div className="text-sm font-medium text-white">{data.personal.nextMilestone}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Leaderboard entries - optimized for mobile scrolling */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-2"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {data?.entries?.map((entry, index) => (
          <motion.div
            key={entry.player.fid}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`
              bg-slate-900/50 border rounded-xl p-3 transition-all duration-200
              ${entry.player.fid === fid 
                ? 'border-blue-500/50 bg-blue-900/20' 
                : 'border-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-center gap-3">
              {/* Rank */}
              <div className="flex-shrink-0 w-8 text-center">
                <span className={`text-sm font-bold ${
                  index === 0 ? 'text-yellow-400' :
                  index === 1 ? 'text-gray-300' :
                  index === 2 ? 'text-yellow-600' :
                  entry.player.fid === fid ? 'text-blue-400' :
                  'text-gray-500'
                }`}>
                  #{index + 1}
                </span>
                {index < 3 && (
                  <div className="text-xs">
                    {index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
                  </div>
                )}
              </div>
              
              {/* Player info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {entry.player.username.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white text-sm truncate">
                    @{entry.player.username}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {entry.player.displayName}
                  </div>
                </div>
              </div>
              
              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-white">
                  {entry.accuracy.toFixed(1)}%
                </div>
                
                {/* Chain badges */}
                <div className="flex gap-1 justify-end mt-1">
                  {chainFilter === 'arbitrum' && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                      🔷
                    </span>
                  )}
                  {chainFilter === 'monad' && (
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                      🟣
                    </span>
                  )}
                </div>
              </div>
              
              {/* Action button */}
              {entry.player.fid !== fid && onChallengePlayer && (
                <button
                  onClick={() => onChallengePlayer(entry.player.fid)}
                  className="flex-shrink-0 p-2 text-xs bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-lg transition-colors"
                >
                  ⚔️
                </button>
              )}
            </div>
          </motion.div>
        ))}
        
        {/* Empty state */}
        {data?.entries?.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-gray-400 text-sm">No players found</div>
            <div className="text-gray-500 text-xs mt-1">Be the first to play!</div>
          </div>
        )}
      </div>
    </div>
  );
}