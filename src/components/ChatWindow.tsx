"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Timer from "./Timer";
import VotingPanel from "./VotingPanel";
import { ChatMessage } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Props = {
  fid: number;
  // The match is now passed in as a prop
  match: { id: string; opponent: { username: string }; endTime: number };
};

export default function ChatWindow({ fid, match }: Props) {
  const [input, setInput] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use SWR for polling the chat messages
  const {
    data: chatData,
    error,
    mutate,
  } = useSWR(`/api/chat/poll?matchId=${match.id}`, fetcher, {
    refreshInterval: 2000, // Poll every 2 seconds
  });

  const messages: ChatMessage[] = chatData?.messages || [];

  // Scroll to the bottom of the chat window when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const text = input;
    setInput(""); // Clear input immediately for better UX

    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        senderFid: fid,
        text,
      }),
    });

    // Trigger a re-fetch of the messages after sending
    mutate();
  };

  const handleTimeUp = () => {
    setIsTimeUp(true);
  };
  
  const matchDuration = Math.round((match.endTime - Date.now()) / 1000);

  return (
    <div className="bg-slate-800 rounded-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">
          Chatting with @{match.opponent.username}
        </h2>
        {match.endTime && <Timer duration={matchDuration > 0 ? matchDuration : 0} onComplete={handleTimeUp} />}
      </div>

      {/* Message Display Area */}
      <div className="h-80 overflow-y-auto bg-slate-900/50 rounded-lg p-4 space-y-4 mb-4">
        {error && <div className="text-center text-red-400">Failed to load messages.</div>}
        {!chatData && !error && <div className="text-center text-gray-400">Loading chat...</div>}
        {chatData && messages.length === 0 && (
            <div className="text-center text-gray-500">
                Say hello! Your conversation starts now.
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender.fid === fid ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                msg.sender.fid === fid
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-200"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
            <span className="text-xs text-gray-500 mt-1">
              @{msg.sender.username}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {isTimeUp ? (
        <VotingPanel matchId={match.id} voterFid={fid} />
      ) : (
        <div className="flex gap-2">
          <input
            className="flex-grow bg-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
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
