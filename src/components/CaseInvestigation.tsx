"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher, getApiUrl, requestJson } from "@/lib/fetcher";

type Artefact = {
  id: string;
  kind: string;
  author: string;
  body: string;
  createdAt: number;
  seenAt: number | null;
};

type Person = {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
};

type Props = {
  fid: number;
  caseId: string;
  onBack: () => void;
};

/**
 * Case investigation — artefact stream without tournament timers/votes.
 */
export default function CaseInvestigation({ fid, caseId, onBack }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, mutate, isLoading } = useSWR<{
    case: { id: string; state: string };
    artefacts: Artefact[];
    person: Person | null;
  }>(getApiUrl(`/api/cases/${caseId}?fid=${fid}`), fetcher, {
    refreshInterval: 8000,
    revalidateOnFocus: true,
  });

  const artefacts = data?.artefacts || [];
  const person = data?.person;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [artefacts.length, typing]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await requestJson<{
        typingIndicator?: { duration: number };
      }>(`/api/cases/${caseId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, text }),
      });
      if (res.typingIndicator?.duration) {
        setTyping(true);
        setTimeout(() => setTyping(false), Math.min(res.typingIndicator.duration, 3000));
      }
      await mutate();
    } catch (err) {
      console.error("[CaseInvestigation] send failed:", err);
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, sending, caseId, fid, mutate]);

  const handleLeave = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await requestJson(`/api/cases/${caseId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });
      onBack();
    } catch (err) {
      console.error("[CaseInvestigation] leave failed:", err);
      setLeaving(false);
    }
  }, [leaving, caseId, fid, onBack]);

  return (
    <div className="w-full flex flex-col space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          {leaving ? "Stepping away…" : "← Step away"}
        </button>
        {person && (
          <div className="flex items-center gap-2 min-w-0">
            {person.pfpUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.pfpUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-white/10"
              />
            ) : null}
            <div className="text-right min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                @{person.username}
              </p>
              <p className="text-xs text-gray-500">Subject</p>
            </div>
          </div>
        )}
      </div>

      {artefacts.length > 0 && (
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
            {artefacts.length} {artefacts.length === 1 ? "update" : "updates"}
            in this case
          </span>
        </div>
      )}

      <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 h-80 overflow-y-auto space-y-3">
        {isLoading && (
          <p className="text-sm text-gray-500 text-center py-8">Loading case file…</p>
        )}
        {!isLoading && artefacts.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No messages yet. Ask something — then step away and see what happens.
          </p>
        )}
        {artefacts.map((a) => {
          const isInvestigator = a.author === "investigator";
          const isOffline =
            a.kind === "offline_follow_up" || a.kind === "offline_echo";
          const isEcho = a.kind === "offline_echo";
          return (
            <div
              key={a.id}
              className={`flex ${isInvestigator ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isInvestigator
                    ? "bg-blue-600/80 text-white"
                    : isOffline
                      ? "bg-amber-900/50 border border-amber-500/30 text-amber-50"
                      : "bg-slate-800 text-gray-100 border border-white/5"
                }`}
              >
                {isOffline && (
                  <p className="text-[10px] uppercase tracking-wide text-amber-400/80 mb-1">
                    {isEcho ? "Later thought" : "While you were away"}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{a.body}</p>
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-gray-400 text-xs px-3 py-2 rounded-2xl border border-white/5">
              typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question…"
          className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
