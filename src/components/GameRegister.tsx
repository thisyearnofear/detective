'use client';

import { useState } from 'react';

type Props = { fid: number };

export default function GameRegister({ fid }: Props) {
  const [status, setStatus] = useState<string>('');
  const [registered, setRegistered] = useState(false);

  const register = async () => {
    setStatus('Registering...');
    const res = await fetch('/api/game/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fid }),
    }).then((r) => r.json());
    if (res.success) {
      setRegistered(true);
      setStatus('Registered. You can start chatting.');
    } else {
      setStatus(res.error || 'Registration failed');
    }
  };

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Neynar score gate ≥ 0.8</div>
          <div className="text-sm text-gray-300">FID: {fid}</div>
        </div>
        <button className="btn-primary" onClick={register} disabled={registered}>Register</button>
      </div>
      {status && <div className="mt-3 text-sm text-gray-300">{status}</div>}
    </div>
  );
}

