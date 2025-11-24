"use client";

import { useState } from "react";

type Props = { matchId: string; voterFid: number };

export default function VotingPanel({ matchId, voterFid }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async (guess: "REAL" | "BOT") => {
    setSubmitting(true);
    const res = await fetch("/api/vote/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, voterFid, guess }),
    }).then((r) => r.json());
    setResult(res);
    setSubmitting(false);
  };

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <button
          className="btn-secondary"
          onClick={() => submit("REAL")}
          disabled={submitting || !matchId || !!result?.finalized}
        >
          Real
        </button>
        <button
          className="btn-primary"
          onClick={() => submit("BOT")}
          disabled={submitting || !matchId || !!result?.finalized}
        >
          Bot
        </button>
      </div>
      {result && (
        <div className="mt-4 text-sm">
          {result.finalized ? (
            <div className="text-green-300">
              Match finalized. Leaderboard updated.
            </div>
          ) : (
            <div className="text-gray-300">
              Vote recorded. Waiting for opponent.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
