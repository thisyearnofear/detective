'use client';

import { useState } from 'react';

type Props = { matchId: string; voterFid: number };

export default function VotingPanel({ matchId, voterFid }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async (guess: 'REAL' | 'BOT') => {
    setSubmitting(true);
    const res = await fetch('/api/vote/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, voterFid, guess }),
    }).then((r) => r.json());
    setResult(res);
    setSubmitting(false);
  };

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={() => submit('REAL')} disabled={submitting || !matchId}>Real</button>
        <button className="btn-primary" onClick={() => submit('BOT')} disabled={submitting || !matchId}>Bot</button>
      </div>
      {result?.leaderboard && (
        <div className="mt-4 text-sm text-gray-300">
          Leaderboard updated.
        </div>
      )}
    </div>
  );
}

