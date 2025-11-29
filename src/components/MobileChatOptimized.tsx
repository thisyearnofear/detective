'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import ChatWindow from './ChatWindow';
import VoteToggle from './VoteToggle';

type Props = {
  fid: number;
  matches: any[];
  currentVotes: Record<string, 'REAL' | 'BOT'>;
  onVoteToggle: (matchId: string) => void;
  onMatchComplete: (matchId: string) => void;
  currentRound: number;
  totalRounds: number;
};

export default function MobileChatOptimized({
  fid,
  matches,
  currentVotes,
  onVoteToggle,
  onMatchComplete,
  currentRound,
  totalRounds
}: Props) {
  const [activeSlot, setActiveSlot] = useState<number>(1);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-switch to available slot if current is empty
  useEffect(() => {
    if (!matches[activeSlot - 1] && matches.length > 0) {
      const availableSlot = matches[0] ? 1 : matches[1] ? 2 : 1;
      setActiveSlot(availableSlot);
    }
  }, [matches, activeSlot]);

  // Swipe handling for chat switching
  const handleSwipe = (info: PanInfo) => {
    const threshold = 50;
    
    if (Math.abs(info.offset.x) > threshold) {
      if (info.offset.x > 0 && activeSlot === 2) {
        setActiveSlot(1);
        setSwipeDirection('right');
      } else if (info.offset.x < 0 && activeSlot === 1) {
        setActiveSlot(2);
        setSwipeDirection('left');
      }
    }
    
    setTimeout(() => setSwipeDirection(null), 300);
  };

  // Quick action handlers
  const handleQuickVoteToggle = (slotNum: number) => {
    const match = matches[slotNum - 1];
    if (match && !match.voteLocked) {
      onVoteToggle(match.id);
    }
  };

  // Get available matches for slots
  const getMatchForSlot = (slotNum: number) => {
    return matches[slotNum - 1] || null;
  };

  // Check if slot has unread activity (new messages, etc.)
  const hasActivity = (slotNum: number) => {
    const match = getMatchForSlot(slotNum);
    if (!match) return false;
    
    // Simple heuristic: assume activity if recent messages
    const lastMessage = match.messages?.[match.messages.length - 1];
    if (!lastMessage) return false;
    
    return Date.now() - lastMessage.timestamp < 10000; // 10 seconds
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/50" ref={containerRef}>
      {/* Header with round info and chat switcher */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-lg border-b border-white/10 p-4">
        {/* Round indicator */}
        <div className="text-center mb-3">
          <span className="bg-slate-700 px-3 py-1 rounded-full text-xs text-blue-300">
            Round {currentRound} of {totalRounds}
          </span>
        </div>

        {/* Chat slot switcher */}
        <div className="flex gap-2 mb-3">
          {[1, 2].map((slotNum) => {
            const match = getMatchForSlot(slotNum);
            const isActive = activeSlot === slotNum;
            const activity = hasActivity(slotNum);
            
            return (
              <button
                key={slotNum}
                onClick={() => setActiveSlot(slotNum)}
                className={`
                  relative flex-1 px-4 py-3 rounded-xl border transition-all duration-200
                  ${isActive 
                    ? 'bg-slate-800 border-blue-500/50 text-white' 
                    : 'bg-slate-800/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }
                `}
              >
                {/* Activity indicator */}
                {activity && !isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"
                  />
                )}

                <div className="flex items-center justify-between">
                  <div className="text-left min-w-0 flex-1">
                    {match ? (
                      <>
                        <div className="text-sm font-medium truncate">
                          @{match.opponent.username}
                        </div>
                        <div className="text-xs text-gray-500">
                          {match.voteLocked ? 'Locked' : 'Active'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium">Chat {slotNum}</div>
                        <div className="text-xs text-gray-500">Empty</div>
                      </>
                    )}
                  </div>
                  
                  {/* Current vote indicator */}
                  {match && (
                    <div className={`
                      w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center
                      ${currentVotes[match.id] === 'BOT' 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }
                    `}>
                      {currentVotes[match.id] === 'BOT' ? '🤖' : '👤'}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Swipe hint */}
        <div className="text-center text-xs text-gray-500">
          👈 Swipe between chats 👉
        </div>
      </div>

      {/* Chat content area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlot}
            initial={{ x: swipeDirection === 'left' ? 100 : swipeDirection === 'right' ? -100 : 0, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: swipeDirection === 'left' ? -100 : swipeDirection === 'right' ? 100 : 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_event: any, info: PanInfo) => handleSwipe(info)}
            className="absolute inset-0"
          >
            {(() => {
              const match = getMatchForSlot(activeSlot);
              
              if (!match) {
                return (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-6xl mb-4">💭</div>
                    <h3 className="text-lg font-bold text-white mb-2">Chat Slot {activeSlot}</h3>
                    <p className="text-gray-400 text-sm mb-4">Waiting for opponent...</p>
                    <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                );
              }

              return (
                <div className="h-full flex flex-col">
                  {/* Chat area */}
                  <div className="flex-1 min-h-0">
                    <ChatWindow
                      fid={fid}
                      match={match}
                      currentVote={currentVotes[match.id] || 'REAL'}
                      onVoteToggle={() => onVoteToggle(match.id)}
                      onComplete={() => onMatchComplete(match.id)}
                      isCompact={true}
                      isMobileStacked={true}
                      showVoteToggle={false}
                      isNewMatch={false}
                    />
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 z-20 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="flex items-center justify-between">
          {/* Quick vote toggle for current chat */}
          {(() => {
            const match = getMatchForSlot(activeSlot);
            if (!match || match.voteLocked) {
              return (
                <div className="flex-1 text-center text-gray-500 text-sm">
                  {match?.voteLocked ? 'Vote Locked' : 'No Active Chat'}
                </div>
              );
            }

            return (
              <>
                {/* Vote toggle */}
                <div className="flex-1">
                  <VoteToggle
                    currentVote={currentVotes[match.id] || 'REAL'}
                    onToggle={() => onVoteToggle(match.id)}
                    isLocked={match.voteLocked}
                  />
                </div>
                
                {/* Quick actions */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setShowQuickActions(!showQuickActions)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    <span className="text-sm">⚡</span>
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        {/* Quick actions panel */}
        <AnimatePresence>
          {showQuickActions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-white/10"
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickVoteToggle(1)}
                  disabled={!getMatchForSlot(1) || getMatchForSlot(1)?.voteLocked}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700/50 disabled:bg-slate-800/20 disabled:text-gray-600 text-white text-xs rounded transition-colors"
                >
                  Quick Vote Chat 1
                </button>
                <button
                  onClick={() => handleQuickVoteToggle(2)}
                  disabled={!getMatchForSlot(2) || getMatchForSlot(2)?.voteLocked}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700/50 disabled:bg-slate-800/20 disabled:text-gray-600 text-white text-xs rounded transition-colors"
                >
                  Quick Vote Chat 2
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}