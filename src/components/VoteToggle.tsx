"use client";

import { useEffect, useState } from "react";

interface VoteToggleProps {
  currentVote: "REAL" | "BOT";
  onToggle: () => void;
  isLocked?: boolean;
  showAnimation?: boolean;
  isCompact?: boolean;
  voteResult?: "correct" | "incorrect" | null;
  secondsRemaining?: number;
}

export default function VoteToggle({
  currentVote,
  onToggle,
  isLocked = false,
  showAnimation = true,
  isCompact = false,
  voteResult = null,
  secondsRemaining,
}: VoteToggleProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [lockAnimating, setLockAnimating] = useState(false);

  useEffect(() => {
    if (showAnimation && !hasInteracted && !isLocked) {
      const timer = setTimeout(() => {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 2000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showAnimation, hasInteracted, isLocked]);

  useEffect(() => {
    if (isLocked && !lockAnimating) {
      setLockAnimating(true);
      setTimeout(() => setLockAnimating(false), 600);
    }
  }, [isLocked]);

  const handleToggle = () => {
    if (isLocked) return;
    setHasInteracted(true);
    setIsAnimating(false);
    onToggle();
  };

  const isBot = currentVote === "BOT";
  const size = isCompact ? "h-8" : "h-10";
  const padding = isCompact ? "p-1" : "p-1.5";
  const textSize = isCompact ? "text-xs" : "text-sm";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${textSize} text-gray-400 font-medium`}>
        I think this is a...
      </div>

      <button
        onClick={handleToggle}
        disabled={isLocked}
        className={`
          relative ${size} w-48 rounded-full ${padding}
          transition-all duration-300 ease-in-out
          ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${isBot
            ? "bg-gradient-to-r from-red-900/50 to-red-800/50 hover:from-red-900/60 hover:to-red-800/60"
            : "bg-gradient-to-r from-green-900/50 to-green-800/50 hover:from-green-900/60 hover:to-green-800/60"
          }
          border-2 ${isBot ? "border-red-500/50" : "border-green-500/50"}
          ${isAnimating ? "animate-pulse ring-2 ring-blue-400/50" : ""}
          ${lockAnimating ? "animate-vote-lock" : ""}
          ${voteResult === "correct" ? "animate-vote-correct" : ""}
          ${voteResult === "incorrect" ? "animate-vote-incorrect" : ""}
        `}
        aria-label={`Vote: Currently ${isBot ? "Bot" : "Human"}`}
      >
        <div
          className={`
            absolute top-1 bottom-1 w-[45%]
            ${isBot ? "bg-red-600" : "bg-green-600"}
            rounded-full shadow-lg
            transition-all duration-300 ease-in-out
            ${isBot ? "right-1" : "left-1"}
            ${isAnimating && !hasInteracted ? (isBot ? "animate-wiggle-right" : "animate-wiggle-left") : ""}
          `}
        />

        <div className="relative flex justify-between items-center h-full px-3">
          <span
            className={`
              font-bold ${textSize} transition-all duration-300
              ${!isBot
                ? "text-white drop-shadow-md scale-105"
                : "text-gray-400/80 scale-95"
              }
            `}
          >
            HUMAN
          </span>
          <span
            className={`
              font-bold ${textSize} transition-all duration-300
              ${isBot
                ? "text-white drop-shadow-md scale-105"
                : "text-gray-400/80 scale-95"
              }
            `}
          >
            BOT
          </span>
        </div>
      </button>

      {secondsRemaining !== undefined && secondsRemaining > 0 && secondsRemaining <= 3 && !isLocked && (
        <div className={`${textSize} text-red-400 font-bold text-center animate-pulse`}>
          LOCKING IN {secondsRemaining}s
        </div>
      )}

      {secondsRemaining !== undefined && secondsRemaining > 3 && secondsRemaining <= 10 && !isLocked && (
        <div className={`${textSize} text-yellow-400 text-center`}>
          {secondsRemaining} seconds to lock
        </div>
      )}

      {!hasInteracted && !isLocked && (secondsRemaining === undefined || secondsRemaining > 10) && (
        <div
          className={`
            ${textSize} text-gray-500 text-center
            ${isAnimating ? "animate-fade-in" : "opacity-0"}
            transition-opacity duration-500
          `}
        >
          Click to change your vote
        </div>
      )}

      {voteResult === "correct" && (
        <div className={`${textSize} text-green-400 flex items-center gap-1 animate-vote-feedback`}>
          <span>✓</span>
          <span>Correct vote!</span>
        </div>
      )}
      {voteResult === "incorrect" && (
        <div className={`${textSize} text-red-400 flex items-center gap-1 animate-vote-feedback`}>
          <span>✗</span>
          <span>Better luck next time</span>
        </div>
      )}

      {isLocked && !voteResult && (
        <div className={`${textSize} text-gray-500 flex items-center gap-1`}>
          <span>Vote locked</span>
        </div>
      )}
    </div>
  );
}
