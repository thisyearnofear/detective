'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptics, useSafeArea } from '@/lib/mobile';

type Tab = 'game' | 'leaderboard' | 'profile';

interface NavigationTab {
  id: Tab;
  label: string;
  icon: string;
  badge?: number;
  disabled?: boolean;
}

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  gameState?: 'lobby' | 'playing' | 'results' | 'idle';
  unreadNotifications?: number;
  currentRank?: number;
  rankChange?: number;
};

export default function MobileNavigationTabs({ 
  activeTab, 
  onTabChange, 
  gameState = 'idle',
  unreadNotifications = 0,
  currentRank,
  rankChange
}: Props) {
  const haptic = useHaptics();
  const safeArea = useSafeArea();
  const [showRankBadge, setShowRankBadge] = useState(false);

  // Show rank change animation
  useEffect(() => {
    if (rankChange && rankChange !== 0) {
      setShowRankBadge(true);
      setTimeout(() => setShowRankBadge(false), 3000);
    }
  }, [rankChange]);

  const tabs: NavigationTab[] = [
    {
      id: 'game',
      label: gameState === 'playing' ? 'Snooping' : gameState === 'lobby' ? 'Briefing' : 'Case File',
      icon: '🔍',
      disabled: false,
    },
    {
      id: 'leaderboard',
      label: 'Rankings',
      icon: '🏆',
      badge: showRankBadge && rankChange ? Math.abs(rankChange) : undefined,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: '👤',
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
  ];

  const getTabStateClass = (tab: NavigationTab) => {
    if (tab.disabled) return 'text-gray-600 cursor-not-allowed';
    if (activeTab === tab.id) return 'text-white bg-slate-800/50 border-blue-500/30';
    return 'text-gray-400 hover:text-white hover:bg-slate-800/30';
  };

  const getGameStatePulse = () => {
    if (gameState === 'playing') return 'animate-pulse';
    if (gameState === 'lobby') return 'animate-pulse';
    return '';
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-white/10"
      style={{ paddingBottom: `calc(12px + ${safeArea.bottom}px)` }}
    >
      {/* Optimized safe area padding */}
      <div className="px-4 py-3">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (!tab.disabled) {
                  haptic('light'); // Haptic feedback on tap
                  onTabChange(tab.id);
                }
              }}
              className={`
                relative flex flex-col items-center gap-1 px-6 py-2 rounded-xl border transition-all duration-200
                ${getTabStateClass(tab)}
                ${tab.id === 'game' ? getGameStatePulse() : ''}
                active:scale-95 touch-manipulation // Mobile tap optimization
              `}
              disabled={tab.disabled}
            >
              {/* Tab Icon */}
              <div className="relative">
                <span className="text-xl">{tab.icon}</span>
                
                {/* Badge for notifications or rank changes */}
                {tab.badge && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`
                        absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center
                        ${tab.id === 'leaderboard' && rankChange && rankChange > 0 
                          ? 'bg-green-500 text-white' 
                          : tab.id === 'leaderboard' && rankChange && rankChange < 0
                          ? 'bg-red-500 text-white'
                          : 'bg-blue-500 text-white'
                        }
                      `}
                    >
                      {tab.id === 'leaderboard' && rankChange ? (
                        rankChange > 0 ? '↑' : '↓'
                      ) : (
                        tab.badge > 9 ? '9+' : tab.badge
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
              
              {/* Tab Label */}
              <span className="text-xs font-medium tracking-wide">
                {tab.label}
              </span>
              
              {/* Active indicator */}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl border border-blue-500/50 bg-blue-500/10"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>
        
        {/* Current rank display when on leaderboard tab */}
        {activeTab === 'leaderboard' && currentRank && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-2"
          >
            <span className="text-xs text-gray-400">Your Current Rank: </span>
            <span className="text-sm font-bold text-white">#{currentRank}</span>
            {rankChange && rankChange !== 0 && (
              <span className={`text-xs ml-1 ${rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({rankChange > 0 ? '+' : ''}{rankChange})
              </span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}