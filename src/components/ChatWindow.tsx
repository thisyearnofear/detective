"use client";

import { useEffect, useRef, useState } from "react";
import Timer from "./Timer";
import VotingPanel from "./VotingPanel";

type Props = { fid: number; username: string };

export default function ChatWindow({ fid, username }: Props) {
  const [matchId, setMatchId] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const lastTsRef = useRef<string | null>(null);
  const [canChat, setCanChat] = useState(true);

  useEffect(() => {
    const run = async () => {
      await fetch("/api/game/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });
      const m = await fetch(`/api/match/next?fid=${fid}`).then((r) => r.json());
      setMatchId(m.match.id);
    };
    run();
  }, [fid]);

  useEffect(() => {
    if (!matchId) return;
    const id = setInterval(async () => {
      const url = `/api/chat/poll?matchId=${matchId}${
        lastTsRef.current
          ? `&since=${encodeURIComponent(lastTsRef.current)}`
          : ""
      }`;
      const res = await fetch(url).then((r) => r.json());
      if (Array.isArray(res.messages) && res.messages.length) {
        setMessages((prev) => [...prev, ...res.messages]);
        const last = res.messages[res.messages.length - 1];
        lastTsRef.current = last.timestamp;
      }
    }, 3000);
    return () => clearInterval(id);
  }, [matchId]);

  const send = async () => {
    if (!input || !matchId) return;
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        senderFid: fid,
        senderUsername: username,
        content: input,
      }),
    }).then((r) => r.json());
    setMessages(res.messages || []);
    setInput("");
    if (Array.isArray(res.messages) && res.messages.length) {
      const last = res.messages[res.messages.length - 1];
      lastTsRef.current = last.timestamp;
    }
  };

  return (
    <div className="card">
      <div className="mb-2 text-sm text-gray-400">
        Match: {matchId || "waiting"}
      </div>
      {matchId && <Timer seconds={240} onComplete={() => setCanChat(false)} />}
      <div className="h-64 overflow-y-auto space-y-2 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={m.isBot ? "text-blue-300" : "text-gray-200"}>
            <span className="font-semibold">{m.senderUsername}</span>:{" "}
            {m.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message"
          disabled={!canChat}
        />
        <button
          className="btn-primary"
          onClick={send}
          disabled={!matchId || !input || !canChat}
        >
          Send
        </button>
      </div>
      {!canChat && matchId && <VotingPanel matchId={matchId} voterFid={fid} />}
    </div>
  );
}
