// src/hooks/useCountdown.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface CountdownConfig {
  endTime: number; // unix timestamp (ms) - STABLE, don't change mid-countdown
  onComplete?: () => void;
  pollInterval?: number; // poll frequency, default 100ms
  totalDuration?: number; // optional initial duration for % calc (defaults to 60s)
}

interface CountdownResult {
  timeRemaining: number; // milliseconds remaining
  secondsRemaining: number; // ceiling of seconds
  isExpired: boolean; // true after time runs out
  formattedTime: string; // "M:SS" format
  percentRemaining: number; // 0-100 for progress bars
}

/**
 * useCountdown - Reliable timer that syncs with server time
 * 
 * Key Design:
 * - Uses stable endTime (unix timestamp) as single source of truth
 * - Calculates relative duration on first mount (prevents mid-timer changes)
 * - Only syncs with server on initial setup
 * - Updates via setInterval polling (not requestAnimationFrame to save CPU)
 * 
 * IMPORTANT: Pass stable endTime - if it changes, timer will restart.
 * If you need to sync with server, do that BEFORE calling this hook.
 * 
 * Usage:
 *   const { secondsRemaining, formattedTime } = useCountdown({
 *     endTime: serverTime + matchDurationMs,  // Already includes timeOffset
 *     onComplete: () => lockVote()
 *   });
 */
export function useCountdown(config: CountdownConfig): CountdownResult {
  const { endTime, onComplete, pollInterval = 100, totalDuration } = config;
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const initialDurationRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Calculate formatted time string
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Main countdown effect - runs once per endTime change
  useEffect(() => {
    if (!endTime) {
      setTimeRemaining(0);
      return;
    }

    // Reset on new endTime
    completedRef.current = false;
    setIsExpired(false);

    // Calculate initial duration (locked on first call)
    const now = Date.now();
    const initialRemaining = Math.max(0, endTime - now);
    
    if (initialDurationRef.current === null) {
      initialDurationRef.current = totalDuration || initialRemaining || 60000;
    }

    // Update immediately with current time
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setTimeRemaining(remaining);

      // Fire completion once (use ref to prevent duplicate calls)
      if (remaining === 0 && !completedRef.current) {
        completedRef.current = true;
        setIsExpired(true);
        onComplete?.();
      }
    };

    updateCountdown();

    // Poll at regular intervals
    const interval = setInterval(updateCountdown, pollInterval);
    return () => {
      clearInterval(interval);
    };
  }, [endTime, onComplete, pollInterval, totalDuration]);

  const secondsRemaining = Math.ceil(timeRemaining / 1000);
  const formattedTime = formatTime(timeRemaining);
  
  // Use locked initial duration for progress bar (not current remaining)
  const durationForPercent = initialDurationRef.current || 60000;
  const percentRemaining = Math.max(0, (timeRemaining / durationForPercent) * 100);

  return {
    timeRemaining,
    secondsRemaining,
    isExpired,
    formattedTime,
    percentRemaining,
  };
}
