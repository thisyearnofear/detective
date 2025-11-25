"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import { useAblyChat } from "@/hooks/useAblyChat";
import { EMOJI_SHORTCODES } from "@/lib/constants";
import EmojiPicker from "./EmojiPicker";
import VoteToggle from "./VoteToggle";
import ProgressRingTimer from "./ProgressRingTimer";
import OpponentCard from "./OpponentCard";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Feature flag for WebSocket support
const USE_WEBSOCKET = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === "true";

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
  isCompact?: boolean;
  showVoteToggle?: boolean;
};

export default function ChatWindow({
  fid,
  match,
  currentVote,
  onVoteToggle,
  onComplete,
  isCompact = false,
  showVoteToggle = false,
  isNewMatch = false,
}: Props) {
  const [input, setInput] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(Date.now());
  const [warningLevel, setWarningLevel] = useState<
    "none" | "warning" | "critical"
  >("none");
  const [messageCount, setMessageCount] = useState(0);
  const [opponentColors, setOpponentColors] = useState<{
    primary: [number, number, number];
    secondary: [number, number, number];
  } | null>(null);
  const [username, setUsername] = useState<string>(`user${fid}`);
  const [, setUserProfile] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket mode (Ably)
  const {
    messages: wsMessages,
    sendMessage: wsSendMessage,
    loadInitialMessages,
    isConnected,
    isConnecting,
    error: wsError,
  } = useAblyChat({
    fid,
    matchId: match.id,
    onMessage: () => {
      setLastMessageTime(Date.now());
      setWarningLevel("none");
    },
    onError: (error) => {
      console.error("[ChatWindow] WebSocket error:", error);
    },
  });

  const webSocketAvailable = USE_WEBSOCKET && isConnected;
  const shouldFallbackToPolling = USE_WEBSOCKET && (wsError || (!isConnecting && !isConnected));

  const shouldPoll = (shouldFallbackToPolling || !USE_WEBSOCKET) && !match.messages;
  const {
    data: chatData,
    error: pollError,
    mutate,
  } = useSWR(
    shouldPoll ? `/api/chat/batch-poll?matchIds=${match.id}` : null,
    fetcher,
    {
      refreshInterval: shouldFallbackToPolling ? 1000 : 2000,
      refreshWhenHidden: false,
    }
  );

  const messages = webSocketAvailable
    ? wsMessages
    : match.messages || chatData?.chats?.[match.id]?.messages || [];

  const error = webSocketAvailable ? null : (shouldFallbackToPolling ? wsError : pollError);

  // Load initial messages for WebSocket mode
  useEffect(() => {
    if (USE_WEBSOCKET && match.messages && match.messages.length > 0) {
      loadInitialMessages(match.messages);
    }
  }, [match.messages, loadInitialMessages]);

  useEffect(() => {
    if (!USE_WEBSOCKET) return;
    const globalCache: any = (globalThis as any).__PROFILE_CACHE__ || {
      promises: new Map<number, Promise<any>>(),
      values: new Map<number, any>(),
    };
    (globalThis as any).__PROFILE_CACHE__ = globalCache;
    const cached = globalCache.values.get(fid);
    if (cached) {
      setUsername(cached.username || `user${fid}`);
      setUserProfile(cached);
      return;
    }
    const pending = globalCache.promises.get(fid);
    if (pending) {
      pending
        .then((profile: any) => {
          setUsername(profile?.username || `user${fid}`);
          setUserProfile(profile || null);
        })
        .catch(() => {
          setUsername(`user${fid}`);
          setUserProfile({
            fid,
            username: `user${fid}`,
            displayName: `Player ${fid}`,
            pfpUrl: "https://i.imgur.com/vL43u65.jpg",
          });
        });
      return;
    }
    const p = fetch(`/api/profiles/random?fid=${fid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const profile = data?.userProfile || {
          fid,
          username: `user${fid}`,
          displayName: `Player ${fid}`,
          pfpUrl: "https://i.imgur.com/vL43u65.jpg",
        };
        globalCache.values.set(fid, profile);
        globalCache.promises.delete(fid);
        setUsername(profile.username || `user${fid}`);
        setUserProfile(profile);
        return profile;
      })
      .catch(() => {
        const profile = {
          fid,
          username: `user${fid}`,
          displayName: `Player ${fid}`,
          pfpUrl: "https://i.imgur.com/vL43u65.jpg",
        };
        globalCache.values.set(fid, profile);
        globalCache.promises.delete(fid);
        setUsername(profile.username);
        setUserProfile(profile);
        return profile;
      });
    globalCache.promises.set(fid, p);
  }, [fid]);

  // Auto-scroll to bottom on new messages and track count
  useEffect(() => {
    if (messages.length !== messageCount) {
      setMessageCount(messages.length);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messageCount]);

  // Track inactivity
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

  // Unified send message handler (WebSocket or HTTP)
  const handleSend = async () => {
    if (!input.trim()) return;
    if (webSocketAvailable && !isConnected) return;
    if (!webSocketAvailable && shouldFallbackToPolling) return;

    const text = input;
    setInput("");
    setLastMessageTime(Date.now());
    setWarningLevel("none");

    try {
      if (webSocketAvailable) {
        await wsSendMessage(text, { fid, username });
      }

      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, senderFid: fid, text }),
      });

      if (shouldPoll) {
        mutate();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  const handleEmojiSelect = (emoji: string) => {
    setInput(input + emoji);
  };

  // Handle emoji shortcode expansion
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Replace shortcodes with emojis
    Object.entries(EMOJI_SHORTCODES).forEach(([code, emoji]) => {
      // Escape special regex characters in the shortcode
      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      value = value.replace(new RegExp(escapedCode, "g"), emoji);
    });

    setInput(value);
  };

  const matchDuration = Math.round((match.endTime - Date.now()) / 1000);

  // Determine chat height based on compact mode
  const chatHeight = isCompact ? "h-64" : "h-80";

  return (
    <div
      className={`bg-slate-800 rounded-lg ${
        isCompact ? "p-4" : "p-6"
      } transition-all duration-300 relative ${
        warningLevel !== "none" ? "ring-2" : ""
      } ${
        warningLevel === "warning" ? "ring-yellow-500 ring-opacity-50" : ""
      } ${warningLevel === "critical" ? "ring-red-500 ring-opacity-75" : ""}`}
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
      {/* WebSocket connection status */}
      {USE_WEBSOCKET && (
        <>
          {isConnecting && (
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-300 z-10">
              <span className="animate-pulse">●</span>
              Connecting...
            </div>
          )}
          {shouldFallbackToPolling && !isConnecting && (
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-amber-500/20 px-2 py-1 rounded text-xs text-amber-300 z-10">
              <span>●</span>
              Polling
            </div>
          )}
          {!isConnected && !isConnecting && !shouldFallbackToPolling && (
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-500/20 px-2 py-1 rounded text-xs text-red-300 z-10">
              <span>●</span>
              Offline
            </div>
          )}
          {isConnected && (
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-green-500/20 px-2 py-1 rounded text-xs text-green-300 z-10">
              <span>●</span>
              Live
            </div>
          )}
        </>
      )}

      {/* Warning banner */}
      {warningLevel !== "none" && !isTimeUp && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 text-center text-sm rounded-t-lg font-semibold transition-all ${
            warningLevel === "warning"
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

      {/* Opponent Card */}
      <div
        className={`flex justify-between items-start gap-4 ${
          isCompact ? "mb-3" : "mb-4"
        }`}
      >
        <div className="flex-1">
          <OpponentCard
            opponent={match.opponent}
            isNewMatch={isNewMatch}
            compact={isCompact}
            onColorsExtracted={(primary, secondary) => {
              setOpponentColors({ primary, secondary });
            }}
          />
        </div>
        {match.endTime && !isTimeUp && (
          <ProgressRingTimer
            duration={matchDuration > 0 ? matchDuration : 0}
            onComplete={handleTimeUp}
            compact={isCompact}
          />
        )}
      </div>

      {/* Vote toggle (if enabled) */}
      {showVoteToggle && !isTimeUp && !match.voteLocked && (
        <div className="mb-3">
          <VoteToggle
            currentVote={currentVote || "REAL"}
            onToggle={onVoteToggle!}
            isLocked={match.voteLocked}
            showAnimation={isNewMatch}
            isCompact={isCompact}
          />
        </div>
      )}

      {/* Chat messages */}
      <div
        className={`${chatHeight} overflow-y-auto bg-slate-900/50 rounded-lg ${
          isCompact ? "p-3" : "p-4"
        } space-y-3 mb-4`}
      >
        {error && (
          <div className="text-center text-red-400">
            Failed to load messages.
          </div>
        )}
        {!chatData?.chats && !error && shouldPoll && (
          <div className="text-center text-gray-400">Loading chat...</div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-gray-500">
            Say hello! Your conversation starts now.
          </div>
        )}
        {messages.map((msg: any, idx: number) => {
          // Calculate staggered delay for animation
          const delayMs = idx * 40; // 40ms stagger between messages
          const isNewMessage = idx >= messageCount - 1; // Last message is newest
          const animationDelay = isNewMessage ? `${delayMs}ms` : "0ms";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender.fid === fid ? "items-end" : "items-start"
              }`}
              style={{
                animation: isNewMessage
                  ? msg.sender.fid === fid
                    ? `slide-in-down 0.4s ease-out ${animationDelay} both`
                    : `slide-in-up 0.4s ease-out ${animationDelay} both`
                  : "none",
              }}
            >
              <div
                className={`max-w-xs ${
                  isCompact ? "md:max-w-sm" : "md:max-w-md"
                } rounded-lg px-3 py-2 ${
                  msg.sender.fid === fid
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-gray-200"
                }`}
                style={
                  msg.sender.fid !== fid && opponentColors
                    ? {
                        backgroundColor: `rgba(${opponentColors.primary[0]}, ${opponentColors.primary[1]}, ${opponentColors.primary[2]}, 0.15)`,
                        borderLeft: `3px solid rgb(${opponentColors.primary[0]}, ${opponentColors.primary[1]}, ${opponentColors.primary[2]})`,
                      }
                    : {}
                }
              >
                <p className={`${isCompact ? "text-xs" : "text-sm"}`}>
                  {msg.text}
                </p>
              </div>
              <span className="text-xs text-gray-500 mt-1">
                @{msg.sender.username}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area or completion message */}
      {isTimeUp || match.voteLocked ? (
        <div className="text-center py-3 bg-slate-700/50 rounded-lg">
          <p className="text-sm text-gray-300">
            <span className="text-xs text-gray-500">Vote locked • </span>
            <span
              className={`font-bold ${
                currentVote === "BOT" ? "text-red-400" : "text-green-400"
              }`}
            >
              {currentVote === "BOT" ? "🤖 BOT" : "👤 HUMAN"}
            </span>
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            className={`grow bg-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isCompact ? "text-sm" : ""
            } ${
              USE_WEBSOCKET && !isConnected
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              USE_WEBSOCKET && !isConnected
                ? "Connecting..."
                : "Type your message... (try :unicorn: or :fire:)"
            }
            disabled={USE_WEBSOCKET && !isConnected}
          />
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            isCompact={isCompact}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            onClick={handleSend}
            disabled={!input.trim() || (USE_WEBSOCKET && !isConnected)}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
