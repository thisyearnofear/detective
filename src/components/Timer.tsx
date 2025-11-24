'use client';

import { useEffect, useState } from 'react';

type Props = { seconds: number; onComplete?: () => void };

export default function Timer({ seconds, onComplete }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          clearInterval(id);
          if (onComplete) onComplete();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, onComplete]);

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');

  return <div className="text-sm text-gray-400">Time left: {mm}:{ss}</div>;
}

