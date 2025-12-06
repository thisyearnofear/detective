"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EMOJI_SHORTCODES } from "@/lib/constants";
import { useViewport, responsive } from "@/lib/viewport";
import { useCountdown } from "@/hooks/useCountdown";
import {
  useOptimizedEmojiProcessor,
  useOptimizedScroll,
  requestCache,
  useMemoryOptimization
} from "@/lib/performance";
import { useHaptics, usePullToRefresh } from "@/lib/mobile";
import EmojiPicker from "./EmojiPicker";
import VoteToggle from "./VoteToggle";
import ProgressRingTimer from "./ProgressRingTimer";
import OpponentCard from "./OpponentCard";
import VirtualizedMessageList from "./VirtualizedMessageList";


type Props = {
  fid: number;
  match: {
    id: string;
    opponent: {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl: string;
    };
    endTime: number;
    slotNumber?: number;
    messages?: any[];
    voteLocked?: boolean;
  };
  currentVote?: "REAL" | "BOT";
  isNewMatch?: boolean;
  onVoteToggle?: () => void;
  onComplete?: () => void;
  showVoteToggle?: boolean;
  timeOffset?: number;
  variant?: "full" | "compact" | "minimal"; // Replaces isCompact + isMobileStacked
  onRefresh?: () => Promise<void>; // Callback to refresh match data
};

export default function ChatWindow({
  fid,
  match,
  currentVote,
  onVoteToggle,
  onComplete,
  showVoteToggle = false,
  isNewMatch = false,
  timeOffset = 0,
  variant = "full",
  onRefresh,
}: Props) {
  const { isFarcasterFrame } = useViewport();
  const { safeSetState } = useMemoryOptimization();
  const processEmojis = useOptimizedEmojiProcessor();
  const haptic = useHaptics();

  // OPTIMIZED STATE - Reduced re-renders
  const [input, setInput] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(Date.now());
  const [warningLevel, setWarningLevel] = useState<"none" | "warning" | "critical">("none");
  const [messageCount, setMessageCount] = useState(0);
  const [opponentColors, setOpponentColors] = useState<{
    primary: [number, number, number];
    secondary: [number, number, number];
  } | null>(null);

  // Countdown timer for vote lock warning
  const { secondsRemaining } = useCountdown({
    endTime: match.endTime + (timeOffset || 0), // Sync with server
    onComplete: () => setIsTimeUp(true),
    pollInterval: 100,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // PERFORMANCE OPTIMIZATIONS
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // PULL-TO-REFRESH for message updates (calls parent's refresh callback)
  const {
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePullToRefresh(async () => {
    haptic('medium');
    if (onRefresh) {
      await onRefresh();
    }
  }, { enabled: isFarcasterFrame });

  // Messages now come from props (single source of truth from parent)
  const messages = match.messages || [];

  // OPTIMIZED SCROLL DETECTION - Throttled for performance
  const handleScroll = useCallback(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // If user is within 50px of bottom, enable autoscroll
    setShouldAutoScroll(distanceFromBottom < 50);

    // Debounced user scrolling flag
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      safeSetState(() => setIsUserScrolling(false));
    }, 1000);
  }, [safeSetState]);

  useOptimizedScroll(handleScroll, {
    element: chatContainerRef,
    throttle: 16, // 60fps
    passive: true
  });

  // OPTIMIZED AUTOSCROLL - RAF-based for smoother performance
  useEffect(() => {
    if (messages.length !== messageCount) {
      setMessageCount(messages.length);

      // Only auto-scroll if user isn't actively scrolling and is near bottom
      if (shouldAutoScroll && !isUserScrolling) {
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
              behavior: isFarcasterFrame ? "auto" : "smooth" // Instant on mobile for better performance
            });
          }
        });
      }
    }
  }, [messages, messageCount, shouldAutoScroll, isUserScrolling, isFarcasterFrame]);

  useEffect(() => {
    const checkActivity = setInterval(() => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 45000) {
        setWarningLevel("critical");
      } else if (timeSinceLastMessage > 30000) {
        setWarningLevel("warning");
      } else {
        setWarningLevel("none");
      }
    }, 1000);
    return () => clearInterval(checkActivity);
  }, [lastMessageTime]);

  // OPTIMIZED MESSAGE SENDING with haptic feedback
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    haptic('light'); // Haptic feedback on send
    const text = input;
    setInput("");
    setLastMessageTime(Date.now());
    setWarningLevel("none");

    // Force autoscroll when user sends a message
    setShouldAutoScroll(true);
    setIsUserScrolling(false);

    try {
      await requestCache.fetch(
        `send_${match.id}_${Date.now()}`,
        () => fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId: match.id, senderFid: fid, text }),
        }).then(res => res.json()),
        0 // No caching for sends
      );

      // Trigger parent refresh to get updated messages
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      haptic('error'); // Error haptic
      console.error("Failed to send message:", err);
      // Restore input on error
      setInput(text);
    }
  }, [input, match.id, fid, haptic, onRefresh]);

  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    if (onComplete) onComplete();
  }, [onComplete]);

  const handleEmojiSelect = (emoji: string) => {
    setInput(input + emoji);
  };

  // OPTIMIZED EMOJI PROCESSING - Batched and cached
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const processedValue = processEmojis(value, EMOJI_SHORTCODES);
    setInput(processedValue);
  }, [processEmojis]);

  const getSyncedTime = () => Date.now() + timeOffset;
  const matchDuration = Math.round((match.endTime - getSyncedTime()) / 1000);

  // CONSOLIDATED: Single source for all responsive styling
  const styles = {
    container: `bg-slate-800 rounded-lg transition-all duration-300 relative ${isFarcasterFrame ? responsive.padding.small :
      variant === "compact" ? responsive.padding.medium :
        responsive.padding.large
      }`,
    chatHeight: isFarcasterFrame ? "h-32" : variant === "compact" ? "h-48" : "h-80",
    spacing: isFarcasterFrame ? "mb-2" : variant === "compact" ? "mb-3" : "mb-4",
    messageSpacing: isFarcasterFrame ? "p-2 space-y-2" : variant === "compact" ? "p-3 space-y-2" : "p-4 space-y-3",
  };

  return (
    <div
      className={`${styles.container} ${warningLevel !== "none" ? "ring-2" : ""
        } ${warningLevel === "warning" ? "ring-yellow-500 ring-opacity-50" : ""} ${warningLevel === "critical" ? "ring-red-500 ring-opacity-75" : ""
        }`}
      style={
        warningLevel !== "none"
          ? {
            boxShadow:
              warningLevel === "warning"
                ? "inset 0 0 20px rgba(234, 179, 8, 0.2), 0 0 15px rgba(234, 179, 8, 0.15)"
                : "inset 0 0 20px rgba(239, 68, 68, 0.25), 0 0 20px rgba(239, 68, 68, 0.2)",
          }
          : {}
      }
    >
      {warningLevel !== "none" && !isTimeUp && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 text-center text-sm rounded-t-lg font-semibold transition-all ${warningLevel === "warning"
            ? "bg-gradient-to-r from-yellow-500/30 to-amber-500/20 text-yellow-200 animate-inactivity-warning"
            : "bg-gradient-to-r from-red-500/40 to-orange-500/30 text-red-100 animate-inactivity-critical"
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            {warningLevel === "warning" && (
              <>
                <span className="animate-bounce">⚠️</span>
                <span>Send a message to stay active!</span>
              </>
            )}
            {warningLevel === "critical" && (
              <>
                <span className="animate-pulse">🚨</span>
                <span>Send a message now or forfeit!</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`flex justify-between items-start ${responsive.spacing.small} ${styles.spacing}`}>
        <div className="flex-1 min-w-0">
          <OpponentCard
            opponent={match.opponent}
            isNewMatch={isNewMatch}
            compact={isFarcasterFrame || variant !== "full"}
            onColorsExtracted={(primary, secondary) => {
              setOpponentColors({ primary, secondary });
            }}
          />
        </div>
        {match.endTime && !isTimeUp && (
          <ProgressRingTimer
            duration={matchDuration > 0 ? matchDuration : 60}
            endTime={match.endTime}
            onComplete={handleTimeUp}
            compact={isFarcasterFrame || variant !== "full"}
            timeOffset={timeOffset}
          />
        )}
      </div>

      {showVoteToggle && !isTimeUp && !match.voteLocked && (
        <div className={styles.spacing}>
          <VoteToggle
            currentVote={currentVote || "REAL"}
            onToggle={onVoteToggle!}
            isLocked={match.voteLocked}
            showAnimation={isNewMatch}
            isCompact={isFarcasterFrame || variant !== "full"}
            secondsRemaining={secondsRemaining}
          />
        </div>
      )}

      {/* VIRTUALIZED MESSAGE LIST with pull-to-refresh */}
      <div
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 bg-slate-800/90 rounded-t-lg transition-all"
            style={{
              height: Math.min(pullDistance, 60),
              transform: `translateY(-${Math.min(pullDistance, 60)}px)`
            }}
          >
            {isRefreshing ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : pullDistance > 60 ? (
              <span className="text-xs text-green-400">↓ Release to refresh</span>
            ) : (
              <span className="text-xs text-gray-400">↓ Pull to refresh</span>
            )}
          </div>
        )}

        {(!messages || messages.length === 0) ? (
          <div className={`${styles.chatHeight} flex items-center justify-center bg-slate-900/50 rounded-lg`}>
            <div className="text-center text-gray-500">No messages yet...</div>
          </div>
        ) : (
          <VirtualizedMessageList
            messages={messages || []}
            currentUserId={fid}
            containerHeight={styles.chatHeight}
            opponentColors={opponentColors || undefined}
          />
        )}
      </div>

      {isTimeUp || match.voteLocked ? (
        <div className={`text-center ${isFarcasterFrame ? "py-2" : "py-3"} bg-slate-700/50 rounded-lg`}>
          <p className={isFarcasterFrame ? responsive.text.small : responsive.text.medium}>
            <span className="text-xs text-gray-500">Vote locked • </span>
            <span className={`font-bold ${currentVote === "BOT" ? "text-red-400" : "text-green-400"}`}>
              {currentVote === "BOT" ? "🤖 BOT" : "👤 HUMAN"}
            </span>
          </p>
        </div>
      ) : (
        <div className={isFarcasterFrame ? responsive.spacing.small : responsive.spacing.medium}>
          <input
            className={`grow bg-slate-700 rounded-lg ${isFarcasterFrame ? "px-2 py-1.5" : "px-4 py-2"
              } text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            style={{
              fontSize: '16px', // CRITICAL: Prevents mobile zoom
              WebkitAppearance: 'none',
              borderRadius: '0.5rem'
            }}
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={isFarcasterFrame ? "Type message..." : "Type your message... (try :unicorn: or :fire:)"}
          />
          {!isFarcasterFrame && <EmojiPicker onEmojiSelect={handleEmojiSelect} isCompact={variant !== "full"} />}
          <button
            className={`bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold ${isFarcasterFrame ? "py-1.5 px-3" : "py-2 px-4"
              } ${isFarcasterFrame ? responsive.text.small : responsive.text.medium} rounded-lg transition-colors`}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
