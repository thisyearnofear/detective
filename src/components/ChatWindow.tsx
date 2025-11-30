"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import { EMOJI_SHORTCODES } from "@/lib/constants";
import EmojiPicker from "./EmojiPicker";
import VoteToggle from "./VoteToggle";
import ProgressRingTimer from "./ProgressRingTimer";
import OpponentCard from "./OpponentCard";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  isMobileStacked?: boolean;
  showVoteToggle?: boolean;
  timeOffset?: number;
};

export default function ChatWindow({
  fid,
  match,
  currentVote,
  onVoteToggle,
  onComplete,
  isCompact = false,
  isMobileStacked = false,
  showVoteToggle = false,
  isNewMatch = false,
  timeOffset = 0,
}: Props) {
  const [input, setInput] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(Date.now());
  const [warningLevel, setWarningLevel] = useState<"none" | "warning" | "critical">("none");
  const [messageCount, setMessageCount] = useState(0);
  const [lastValidMessages, setLastValidMessages] = useState<any[]>([]);
  const lastMatchIdRef = useRef<string>(match.id);
  const [opponentColors, setOpponentColors] = useState<{
    primary: [number, number, number];
    secondary: [number, number, number];
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatData, error, mutate } = useSWR(
    `/api/chat/batch-poll?matchIds=${match.id}`,
    fetcher,
    { refreshInterval: 2000, refreshWhenHidden: false, dedupingInterval: 1000 }
  );

  const polledMessages = chatData?.chats?.[match.id]?.messages;
  
  // Clear cache when match changes
  useEffect(() => {
    if (match.id !== lastMatchIdRef.current) {
      lastMatchIdRef.current = match.id;
      setLastValidMessages([]);
    }
  }, [match.id]);
  
  // Update cache when we get live data
  useEffect(() => {
    const currentMessages = match.messages || polledMessages;
    if (Array.isArray(currentMessages) && currentMessages.length > 0) {
      setLastValidMessages(currentMessages);
    }
  }, [match.messages, polledMessages]);
  
  // Determine which messages to show: live data takes priority, cache is fallback
  const liveMessages = match.messages || polledMessages;
  const messages = (Array.isArray(liveMessages) && liveMessages.length > 0) 
    ? liveMessages 
    : lastValidMessages;

  useEffect(() => {
    if (messages.length !== messageCount) {
      setMessageCount(messages.length);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messageCount]);

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

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    setLastMessageTime(Date.now());
    setWarningLevel("none");

    try {
      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, senderFid: fid, text }),
      });
      mutate();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    if (onComplete) onComplete();
  }, [onComplete]);

  const handleEmojiSelect = (emoji: string) => {
    setInput(input + emoji);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    Object.entries(EMOJI_SHORTCODES).forEach(([code, emoji]) => {
      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      value = value.replace(new RegExp(escapedCode, "g"), emoji);
    });
    setInput(value);
  };

  const getSyncedTime = () => Date.now() + timeOffset;
  const matchDuration = Math.round((match.endTime - getSyncedTime()) / 1000);
  const chatHeight = isMobileStacked ? "h-36" : isCompact ? "h-64" : "h-80";

  return (
    <div
      className={`bg-slate-800 rounded-lg ${isMobileStacked ? "p-3" : isCompact ? "p-4" : "p-6"} transition-all duration-300 relative ${
        warningLevel !== "none" ? "ring-2" : ""
      } ${warningLevel === "warning" ? "ring-yellow-500 ring-opacity-50" : ""} ${
        warningLevel === "critical" ? "ring-red-500 ring-opacity-75" : ""
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

      <div className={`flex justify-between items-start gap-2 ${isMobileStacked ? "mb-2" : isCompact ? "mb-3" : "mb-4"}`}>
        <div className="flex-1 min-w-0">
          <OpponentCard
            opponent={match.opponent}
            isNewMatch={isNewMatch}
            compact={isCompact || isMobileStacked}
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
            compact={isCompact || isMobileStacked}
            timeOffset={timeOffset}
          />
        )}
      </div>

      {showVoteToggle && !isTimeUp && !match.voteLocked && (
        <div className={isMobileStacked ? "mb-2" : "mb-3"}>
          <VoteToggle
            currentVote={currentVote || "REAL"}
            onToggle={onVoteToggle!}
            isLocked={match.voteLocked}
            showAnimation={isNewMatch}
            isCompact={isCompact || isMobileStacked}
          />
        </div>
      )}

      <div className={`${chatHeight} overflow-y-auto bg-slate-900/50 rounded-lg ${isMobileStacked ? "p-2 space-y-2" : isCompact ? "p-3 space-y-3" : "p-4 space-y-3"} ${isMobileStacked ? "mb-2" : "mb-4"}`}>
        {error && <div className="text-center text-red-400">Failed to load messages.</div>}
        {messages.length === 0 && !error && <div className="text-center text-gray-500">Say hello! Your conversation starts now.</div>}
        {messages.map((msg: any, idx: number) => {
          const delayMs = idx * 40;
          const isNewMessage = idx >= messageCount - 1;
          const animationDelay = isNewMessage ? `${delayMs}ms` : "0ms";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender.fid === fid ? "items-end" : "items-start"}`}
              style={{
                animation: isNewMessage
                  ? msg.sender.fid === fid
                    ? `slide-in-down 0.4s ease-out ${animationDelay} both`
                    : `slide-in-up 0.4s ease-out ${animationDelay} both`
                  : "none",
              }}
            >
              <div
                className={`${isMobileStacked ? "max-w-[85%]" : "max-w-xs"} ${isCompact ? "md:max-w-sm" : "md:max-w-md"} rounded-lg ${isMobileStacked ? "px-2 py-1" : "px-3 py-2"} ${
                  msg.sender.fid === fid ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-200"
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
                <p className={`${isMobileStacked || isCompact ? "text-xs" : "text-sm"}`}>{msg.text}</p>
              </div>
              {!isMobileStacked && <span className="text-xs text-gray-500 mt-1">@{msg.sender.username}</span>}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {isTimeUp || match.voteLocked ? (
        <div className={`text-center ${isMobileStacked ? "py-2" : "py-3"} bg-slate-700/50 rounded-lg`}>
          <p className={`${isMobileStacked ? "text-xs" : "text-sm"} text-gray-300`}>
            <span className="text-xs text-gray-500">Vote locked • </span>
            <span className={`font-bold ${currentVote === "BOT" ? "text-red-400" : "text-green-400"}`}>
              {currentVote === "BOT" ? "🤖 BOT" : "👤 HUMAN"}
            </span>
          </p>
        </div>
      ) : (
        <div className={`flex ${isMobileStacked ? "gap-1" : "gap-2"}`}>
          <input
            className={`grow bg-slate-700 rounded-lg ${isMobileStacked ? "px-2 py-1.5 text-xs" : "px-4 py-2"} text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isCompact && !isMobileStacked ? "text-sm" : ""
            }`}
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={isMobileStacked ? "Type message..." : "Type your message... (try :unicorn: or :fire:)"}
          />
          {!isMobileStacked && <EmojiPicker onEmojiSelect={handleEmojiSelect} isCompact={isCompact} />}
          <button
            className={`bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold ${isMobileStacked ? "py-1.5 px-3 text-xs" : "py-2 px-4"} rounded-lg transition-colors`}
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
