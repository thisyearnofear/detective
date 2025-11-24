"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import Image from "next/image";
import Timer from "./Timer";
import EmojiPicker from "./EmojiPicker";

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
}: Props) {
  const [input, setInput] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(Date.now());
  const [warningLevel, setWarningLevel] = useState<
    "none" | "warning" | "critical"
  >("none");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll for messages if not provided (backward compatibility)
  const shouldPoll = !match.messages;
  const {
    data: chatData,
    error,
    mutate,
  } = useSWR(
    shouldPoll ? `/api/chat/batch-poll?matchIds=${match.id}` : null,
    fetcher,
    {
      refreshInterval: 2000,
      refreshWhenHidden: false,
    },
  );

  const messages =
    match.messages || chatData?.chats?.[match.id]?.messages || [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Reset last message time when sending
  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    setLastMessageTime(Date.now());
    setWarningLevel("none");

    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id, senderFid: fid, text }),
    });

    if (shouldPoll) {
      mutate();
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

    // Define shortcode mappings
    const shortcodes: Record<string, string> = {
      ":unicorn:": "🦄",
      ":tophat:": "🎩",
      ":rainbow:": "🌈",
      ":purple:": "🟣",
      ":rocket:": "🚀",
      ":eyes:": "👀",
      ":fire:": "🔥",
      ":sparkles:": "✨",
      ":salute:": "🫡",
      ":100:": "💯",
      ":handshake:": "🤝",
      ":purpleheart:": "💜",
      ":star:": "🌟",
      ":zap:": "⚡",
      ":dart:": "🎯",
      ":gem:": "💎",
    };

    // Replace shortcodes with emojis
    Object.entries(shortcodes).forEach(([code, emoji]) => {
      value = value.replace(new RegExp(code, "g"), emoji);
    });

    setInput(value);
  };

  const matchDuration = Math.round((match.endTime - Date.now()) / 1000);

  // Determine chat height based on compact mode
  const chatHeight = isCompact ? "h-64" : "h-80";

  return (
    <div
      className={`bg-slate-800 rounded-lg ${isCompact ? "p-4" : "p-6"} ${
        warningLevel !== "none" ? "ring-2" : ""
      } ${warningLevel === "warning" ? "ring-yellow-500" : ""} ${
        warningLevel === "critical" ? "ring-red-500 animate-pulse" : ""
      }`}
    >
      {/* Warning banner */}
      {warningLevel !== "none" && !isTimeUp && (
        <div
          className={`absolute top-0 left-0 right-0 p-2 text-center text-sm rounded-t-lg ${
            warningLevel === "warning"
              ? "bg-yellow-500/20 text-yellow-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {warningLevel === "warning" && "⚠️ Send a message to stay active!"}
          {warningLevel === "critical" && "🚨 Send a message now or forfeit!"}
        </div>
      )}

      {/* Header */}
      <div
        className={`flex justify-between items-center ${isCompact ? "mb-3" : "mb-4"}`}
      >
        <div className="flex items-center gap-3">
          <Image
            className={`${isCompact ? "h-10 w-10" : "h-12 w-12"} rounded-full`}
            src={match.opponent.pfpUrl}
            alt={match.opponent.username}
            width={isCompact ? 40 : 48}
            height={isCompact ? 40 : 48}
          />
          <div>
            <h2 className={`${isCompact ? "text-base" : "text-lg"} font-bold`}>
              @{match.opponent.username}
            </h2>
            {!isCompact && (
              <p className="text-sm text-gray-400">
                Is this person real or a bot?
              </p>
            )}
          </div>
        </div>
        {match.endTime && !isTimeUp && (
          <Timer
            duration={matchDuration > 0 ? matchDuration : 0}
            onComplete={handleTimeUp}
          />
        )}
      </div>

      {/* Vote toggle button (if enabled) */}
      {showVoteToggle && !isTimeUp && !match.voteLocked && (
        <div className="mb-3">
          <button
            onClick={onVoteToggle}
            className={`w-full py-2 rounded-lg font-medium transition-all ${
              currentVote === "BOT"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : currentVote === "REAL"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-gray-300"
            }`}
          >
            {currentVote === "BOT" ? (
              <>🤖 I think this is a BOT</>
            ) : currentVote === "REAL" ? (
              <>👤 I think this is a HUMAN</>
            ) : (
              <>❓ Click to vote</>
            )}
          </button>
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
        {messages.map((msg: any) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender.fid === fid ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-xs ${
                isCompact ? "md:max-w-sm" : "md:max-w-md"
              } rounded-lg px-3 py-2 ${
                msg.sender.fid === fid
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-200"
              }`}
            >
              <p className={`${isCompact ? "text-xs" : "text-sm"}`}>
                {msg.text}
              </p>
            </div>
            <span className="text-xs text-gray-500 mt-1">
              @{msg.sender.username}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area or completion message */}
      {isTimeUp || match.voteLocked ? (
        <div className="text-center py-3 bg-slate-700/50 rounded-lg">
          <p className="text-sm text-gray-300">
            {match.voteLocked ? "Vote locked! " : "Time's up! "}
            {currentVote ? (
              <>
                You voted:{" "}
                <span className="font-bold">
                  {currentVote === "BOT" ? "🤖 Bot" : "👤 Human"}
                </span>
              </>
            ) : (
              "No vote submitted"
            )}
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            className={`grow bg-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isCompact ? "text-sm" : ""
            }`}
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message... (try :unicorn: or :fire:)"
          />
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            isCompact={isCompact}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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
