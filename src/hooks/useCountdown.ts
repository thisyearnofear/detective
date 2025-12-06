// src/hooks/useCountdown.ts
'use client';

import { useEffect, useState, useCallback } from 'react';

interface CountdownConfig {
  endTime: number; // unix timestamp (ms)
  onComplete?: () => void;
  pollInterval?: number; // default 100ms for smooth updates
}

interface CountdownResult {
  timeRemaining: number; // milliseconds
  secondsRemaining: number;
  isExpired: boolean;
  formattedTime: string; // "1:23"
  percentRemaining: number; // 0-100
}

/**
 * useCountdown - Single source of truth for all countdown timers
 * 
 * Syncs with server time and updates smoothly.
 * Replaces scattered countdown logic across components.
 * 
 * Usage:
 *   const { timeRemaining, secondsRemaining, formattedTime } = useCountdown({
 *     endTime: 1702123456789,
 *     onComplete: () => console.log('Done!')
 *   });
 */
export function useCountdown(config: CountdownConfig): CountdownResult {
  const { endTime, onComplete, pollInterval = 100 } = config;
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  // Calculate formatted time string
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Main countdown effect
  useEffect(() => {
    if (!endTime) return;

    // Update immediately
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setTimeRemaining(remaining);

      // Trigger completion
      if (remaining === 0 && !isExpired) {
        setIsExpired(true);
        onComplete?.();
      }
    };

    updateCountdown();

    // Poll at regular intervals
    const interval = setInterval(updateCountdown, pollInterval);
    return () => clearInterval(interval);
  }, [endTime, onComplete, isExpired, pollInterval]);

  const secondsRemaining = Math.ceil(timeRemaining / 1000);
  const formattedTime = formatTime(timeRemaining);
  
  // For progress bars (0-100%)
  const totalDuration = Math.max(timeRemaining, 60000); // Assume at least 1min total
  const percentRemaining = (timeRemaining / totalDuration) * 100;

  return {
    timeRemaining,
    secondsRemaining,
    isExpired,
    formattedTime,
    percentRemaining,
  };
}
