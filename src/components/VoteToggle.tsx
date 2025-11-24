"use client";

import { useEffect, useState } from "react";

interface VoteToggleProps {
  currentVote: "REAL" | "BOT";
  onToggle: () => void;
  isLocked?: boolean;
  showAnimation?: boolean;
  isCompact?: boolean;
}

export default function VoteToggle({
  currentVote,
  onToggle,
  isLocked = false,
  showAnimation = true,
  isCompact = false,
}: VoteToggleProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Show hint animation in first 5 seconds if not interacted
  useEffect(() => {
    if (showAnimation && !hasInteracted && !isLocked) {
      const timer = setTimeout(() => {
        setIsAnimating(true);
        // Animate for 2 seconds
        setTimeout(() => setIsAnimating(false), 2000);
      }, 1000); // Start after 1 second

      return () => clearTimeout(timer);
    }
  }, [showAnimation, hasInteracted, isLocked]);

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
    <div className="flex flex-col items-center gap-2">
      {/* Label */}
      <div className={`${textSize} text-gray-400 font-medium`}>
        I think this is a...
      </div>

      {/* Toggle Container */}
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
        `}
        aria-label={`Vote: Currently ${isBot ? "Bot" : "Human"}`}
      >
        {/* Sliding Background Pill */}
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

        {/* Labels */}
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
            👤 HUMAN
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
            🤖 BOT
          </span>
        </div>
      </button>

      {/* Hint Text */}
      {!hasInteracted && !isLocked && (
        <div
          className={`
            ${textSize} text-gray-500 text-center
            ${isAnimating ? "animate-fade-in" : "opacity-0"}
            transition-opacity duration-500
          `}
        >
          ↑ Click to change your vote
        </div>
      )}

      {/* Locked State Indicator */}
      {isLocked && (
        <div className={`${textSize} text-gray-500 flex items-center gap-1`}>
          <span>🔒</span>
          <span>Vote locked</span>
        </div>
      )}
    </div>
  );
}

// Add these animations to your tailwind.config.ts extend section:
// animation: {
//   'wiggle-left': 'wiggle-left 1s ease-in-out infinite',
//   'wiggle-right': 'wiggle-right 1s ease-in-out infinite',
//   'fade-in': 'fade-in 0.5s ease-in-out',
// },
// keyframes: {
//   'wiggle-left': {
//     '0%, 100%': { transform: 'translateX(0)' },
//     '50%': { transform: 'translateX(10px)' },
//   },
//   'wiggle-right': {
//     '0%, 100%': { transform: 'translateX(0)' },
//     '50%': { transform: 'translateX(-10px)' },
//   },
//   'fade-in': {
//     '0%': { opacity: '0' },
//     '100%': { opacity: '1' },
//   },
// }
