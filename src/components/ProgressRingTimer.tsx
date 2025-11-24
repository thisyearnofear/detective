"use client";

import { useEffect, useState } from "react";

interface ProgressRingTimerProps {
  duration: number; // Duration in seconds
  onComplete?: () => void;
  compact?: boolean;
}

export default function ProgressRingTimer({
  duration,
  onComplete,
  compact = false,
}: ProgressRingTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    setRemaining(duration);
  }, [duration]);

  useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, endTime - now);
      const secondsLeft = timeLeft / 1000;

      setRemaining(secondsLeft);
      setIsWarning(secondsLeft <= 30 && secondsLeft > 0);
      setIsCritical(secondsLeft <= 10);

      if (secondsLeft <= 0) {
        setRemaining(0);
        onComplete?.();
      }
    };

    // Update frequently for smooth animation
    const interval = setInterval(updateTimer, 100);
    updateTimer();

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.round(remaining % 60);
  const progress = remaining / duration;

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
      <svg width={size} height={size} className="relative">
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
