'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useViewport, farcaster } from '@/lib/viewport';
import MobileNavigationTabs from './MobileNavigationTabs';
import Leaderboard from './Leaderboard';
import ChatWindow from './ChatWindow';
import GameLobby from './game/GameLobby';

type Tab = 'game' | 'leaderboard' | 'profile';

type Props = {
  fid: number;
  gameState: any;
  sdkUser: any;
  // Game-related props
  matches?: any[];
  currentVotes?: Record<string, 'REAL' | 'BOT'>;
  onVoteToggle?: (matchId: string) => void;
  onMatchComplete?: (matchId: string) => void;
  currentRound?: number;
  totalRounds?: number;
  // Other handlers
  onQuickMatch?: () => void;
  onChallengePlayer?: (targetFid: number) => void;
};

export default function MobileAppContainer({
  fid,
  gameState,
  sdkUser,
  matches = [],
  currentVotes = {},
  onVoteToggle = () => { },
  onMatchComplete = () => { },
  currentRound = 1,
  totalRounds = 5,
  onQuickMatch,
  onChallengePlayer
}: Props) {
  const { isFarcasterFrame } = useViewport();
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [currentRank, setCurrentRank] = useState<number>();
  const [rankChange, setRankChange] = useState<number>();
  const unreadNotifications = 0; // Using a constant since state is not modified

  // Simulate rank changes for demo (replace with real data)
  useEffect(() => {
    // Mock rank data - replace with actual API calls
    setCurrentRank(Math.floor(Math.random() * 100) + 1);
    setRankChange(Math.floor(Math.random() * 10) - 5);
  }, [fid]);

  // Auto-switch to appropriate tab based on game state
  useEffect(() => {
    if (gameState?.state === 'REGISTRATION' && activeTab === 'game') {
      // Stay on game tab during registration
    } else if (gameState?.state === 'LIVE' && matches.length > 0 && activeTab !== 'game') {
      // Auto-switch to game when matches are active
      setActiveTab('game');
    }
  }, [gameState?.state, matches.length, activeTab]);

  // Get current game state for UI
  const getGameState = () => {
    if (gameState?.state === 'REGISTRATION') return 'lobby';
    if (gameState?.state === 'LIVE' && matches.length > 0) return 'playing';
    if (gameState?.state === 'LIVE' && matches.length === 0) return 'results';
    return 'idle';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'game':
        if (gameState?.state === 'REGISTRATION') {
          return (
            <div className="p-4">
              <GameLobby
                currentPlayer={sdkUser}
                isRegistrationOpen={true}
                gameState={gameState}
              />
            </div>
          );
        }

        if (gameState?.state === 'LIVE' && matches.length > 0) {
          return (
            <div className="flex flex-col h-full">
              {/* Chat header */}
              <div className={farcaster.stickyHeader}>
                <div className="text-center py-2">
                  <span className="bg-slate-700 px-3 py-1 rounded-full text-xs text-blue-300">
                    Round {currentRound} of {totalRounds}
                  </span>
                </div>
              </div>
              
              {/* Enhanced ChatWindow */}
              <div className="flex-1 p-4">
                <ChatWindow
                  fid={fid}
                  match={matches[0]}
                  currentVote={currentVotes[matches[0]?.id] || 'REAL'}
                  onVoteToggle={() => onVoteToggle(matches[0]?.id)}
                  onComplete={() => onMatchComplete(matches[0]?.id)}
                  variant="minimal"
                  showVoteToggle={true}
                />
              </div>
            </div>
          );
        }

        // Default game state - waiting or results
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-bold text-white mb-2">Detective</h2>

              {gameState?.state === 'LIVE' ? (
                <>
                  <p className="text-gray-400 mb-6">Waiting for next round...</p>
                  <button
                    onClick={() => setActiveTab('leaderboard')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                  >
                    View Leaderboard
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-6">Ready to test your detective skills?</p>
                  {onQuickMatch && (
                    <button
                      onClick={onQuickMatch}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                    >
                      Quick Match
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </div>
        );

      case 'leaderboard':
        return (
          <div className="h-full overflow-hidden">
            <Leaderboard fid={fid} />
          </div>
        );

      case 'profile':
        return (
          <div className="p-4 space-y-6">
            {/* User Profile Header */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {sdkUser?.username?.slice(0, 2).toUpperCase() || '🔍'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">@{sdkUser?.username || 'detective'}</h2>
              <p className="text-gray-400 text-sm">{sdkUser?.displayName || 'Anonymous Detective'}</p>

              {currentRank && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-sm text-blue-400 mb-1">Current Rank</div>
                  <div className="text-2xl font-bold text-white">#{currentRank}</div>
                  {rankChange && rankChange !== 0 && (
                    <div className={`text-sm ${rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {rankChange > 0 ? '↗' : '↘'} {Math.abs(rankChange)} this week
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('leaderboard')}
                className="bg-slate-900/50 border border-white/10 rounded-xl p-4 text-center hover:border-white/20 transition-colors"
              >
                <div className="text-2xl mb-2">🏆</div>
                <div className="text-sm font-medium text-white">Rankings</div>
              </button>

              {onQuickMatch && (
                <button
                  onClick={onQuickMatch}
                  className="bg-slate-900/50 border border-white/10 rounded-xl p-4 text-center hover:border-white/20 transition-colors"
                >
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="text-sm font-medium text-white">Quick Match</div>
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <h3 className="font-bold text-white mb-3">Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Notifications</span>
                  <button className="w-10 h-6 bg-blue-600 rounded-full relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Sound Effects</span>
                  <button className="w-10 h-6 bg-slate-600 rounded-full relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1"></div>
                  </button>
                </div>
              </div>
            </div>

            {/* App Info */}
            <div className="text-center text-xs text-gray-500">
              <p>Detective v1.0.0</p>
              <p className="mt-1">Human vs AI Detection Game</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950/50 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-auto"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <MobileNavigationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        gameState={getGameState()}
        unreadNotifications={unreadNotifications}
        currentRank={currentRank}
        rankChange={rankChange}
      />
    </div>
  );
}