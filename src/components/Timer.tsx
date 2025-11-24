'use client';

import { useEffect, useState, useRef } from 'react';

type Props = { 
  duration: number; // Duration in seconds
  onComplete?: () => void;
};

export default function Timer({ duration, onComplete }: Props) {
  const [remaining, setRemaining] = useState(duration);
  const onCompleteRef = useRef(onComplete);

  // Keep the onComplete callback reference up-to-date without re-triggering the effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Start with the full duration
    setRemaining(duration);

    const intervalId = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [duration]); // Only re-run the effect if the total duration changes

  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return (
    <div className="text-sm text-blue-300 font-mono bg-slate-700/50 rounded px-2 py-1">
      Time: {minutes}:{seconds}
    </div>
  );
}

