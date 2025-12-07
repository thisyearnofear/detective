"use client";

import { useEffect, useState, useRef } from "react";

interface ProgressRingTimerProps {
  duration: number; // Duration in seconds (initial)
  endTime?: number; // Absolute end time in ms (preferred - from server)
  onComplete?: () => void;
  compact?: boolean;
  timeOffset?: number; // Server time offset for synchronization
}

export default function ProgressRingTimer({
  duration,
  endTime: serverEndTime,
  onComplete,
  compact = false,
  timeOffset = 0,
}: ProgressRingTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const hasCompletedRef = useRef(false);
  const initialDurationRef = useRef(duration);

  // Store initial duration for progress calculation
  useEffect(() => {
    if (duration > 0) {
      initialDurationRef.current = duration;
    }
  }, []);

  useEffect(() => {
    // Reset completion flag when duration changes significantly (new match)
    if (duration > 5) {
      hasCompletedRef.current = false;
      initialDurationRef.current = duration;
    }
    setRemaining(duration);
  }, [duration]);

  useEffect(() => {
    // Frontend grace period to match backend auto-lock timing
    const FRONTEND_GRACE_PERIOD = 3000; // 3 seconds to sync with backend grace periods

    // Use server end time if provided, otherwise calculate from duration
    const baseEndTime = serverEndTime || (Date.now() + duration * 1000);
    const endTime = baseEndTime + FRONTEND_GRACE_PERIOD;

    // Don't start timer if duration is too short (likely stale data)
    if (duration <= 0 && !serverEndTime) {
      return;
    }

    const updateTimer = () => {
      const now = Date.now() + timeOffset; // Use synced time
      const timeLeft = Math.max(0, endTime - now);
      const secondsLeft = timeLeft / 1000;

      setRemaining(secondsLeft);

      // Show warnings based on original timer (without grace period)
      // This keeps the UI warnings at the expected 60s/30s/10s marks
      const originalSecondsLeft = Math.max(0, (baseEndTime - now) / 1000);
      setIsWarning(originalSecondsLeft <= 30 && originalSecondsLeft > 10);
      setIsCritical(originalSecondsLeft <= 10 && originalSecondsLeft > 0);

      // Only trigger onComplete once when grace period expires
      if (secondsLeft <= 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setRemaining(0);
        onComplete?.();
      }
    };

    // Update frequently for smooth animation
    const interval = setInterval(updateTimer, 100);
    updateTimer();

    return () => clearInterval(interval);
  }, [duration, onComplete, timeOffset]);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.round(remaining % 60);
  // Use initial duration for progress calculation to avoid jumps
  const effectiveDuration = initialDurationRef.current > 0 ? initialDurationRef.current : duration;
  const progress = effectiveDuration > 0 ? remaining / effectiveDuration : 0;

  // SVG dimensions
  const size = compact ? 60 : 80;
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.max(0, progress));

  // Determine colors
  let ringColor = "#f59e0b"; // amber
  let textColor = "#fbbf24"; // amber-300
  if (isCritical) {
    ringColor = "#dc2626"; // red-600
    textColor = "#fca5a5"; // red-300
  } else if (isWarning) {
    ringColor = "#d97706"; // orange-600
    textColor = "#fed7aa"; // orange-200
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#334155"
            strokeWidth="2"
          />

          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all ${isCritical ? "animate-pulse" : ""}`}
            style={{
              transformOrigin: `${size / 2}px ${size / 2}px`,
              transform: "rotate(-90deg)",
            }}
          />
        </svg>
        <img
          src="/detective.png"
          alt="Detective"
          className={`${compact ? "w-5 h-5" : "w-7 h-7"} opacity-70`}
        />
      </div>

      {/* Time display */}
      <div
        className={`text-center mt-2 font-bold font-mono ${compact ? "text-sm" : "text-base"}`}
        style={{ color: textColor }}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>

      {/* Warning indicator */}
      {isWarning && !isCritical && (
        <div className="text-xs text-orange-300 mt-1 animate-pulse">
          30 seconds left
        </div>
      )}

      {isCritical && (
        <div className="text-xs text-red-300 mt-1 animate-pulse font-bold">
          ⚠️ Time's up soon!
        </div>
      )}
    </div>
  );
}
