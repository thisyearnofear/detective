"use client";

import { useEffect, useState } from "react";

interface RoundStartLoaderProps {
  // Can be used as inline component (always visible) or modal (controlled by isVisible)
  isVisible?: boolean;
  roundNumber?: number;
  currentRound?: number; // Alias for roundNumber
  totalRounds?: number;
  message?: string;
  onComplete?: () => void;
  // If true, shows as inline component instead of modal overlay
  inline?: boolean;
}

export default function RoundStartLoader({
  isVisible = true,
  roundNumber,
  currentRound,
  totalRounds = 5,
  message,
  onComplete,
  inline = false,
}: RoundStartLoaderProps) {
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<"preparing" | "countdown" | "ready">("preparing");
  
  // Support both roundNumber and currentRound props
  const round = roundNumber ?? currentRound ?? 1;

  useEffect(() => {
    if (!isVisible) {
      setCountdown(3);
      setPhase("preparing");
      return;
    }

    // For inline mode, stay in preparing phase
    if (inline) {
      setPhase("preparing");
      return;
    }

    // Preparing phase (1.5s)
    const prepareTimer = setTimeout(() => {
      setPhase("countdown");
    }, 1500);

    // Countdown (3 seconds, 1 per second)
    let countdownNum = 3;
    const countdownTimer = setInterval(() => {
      countdownNum--;
      setCountdown(countdownNum);
      if (countdownNum === 0) {
        clearInterval(countdownTimer);
        setPhase("ready");
        onComplete?.();
      }
    }, 1000);

    return () => {
      clearTimeout(prepareTimer);
      clearInterval(countdownTimer);
    };
  }, [isVisible, onComplete, inline]);

  if (!isVisible) return null;

  // Inline mode - simpler loading state
  if (inline) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-slate-700 shadow-xl">
        <div className="text-center">
          {/* Round indicator */}
          <div className="mb-6">
            <span className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30">
              Round {round} of {totalRounds}
            </span>
          </div>

          {/* Animated icon */}
          <div className="mb-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Message */}
          <h3 className="text-xl font-bold text-white mb-2">
            {message || "Finding opponents..."}
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Matching you with players and bots
          </p>

          {/* Animated dots */}
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>

          {/* Tips */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-gray-500">
              💡 Tip: You'll chat with 2 opponents simultaneously
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Modal mode - full screen overlay with countdown
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        {phase === "preparing" && (
          <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-4">
              Preparing Round {round}
            </h2>
            <p className="text-gray-400 mb-4">
              {round} of {totalRounds} • {message || "Finding your opponents..."}
            </p>

            {/* Animated loading dots */}
            <div className="flex justify-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" />
              <div className="w-3 h-3 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>

            {/* Info Box */}
            <div className="bg-slate-800/50 rounded-lg p-4 max-w-md mx-auto border border-slate-700">
              <p className="text-sm text-gray-300">
                <span className="block font-semibold mb-1">📊 Quick Rules</span>
                1 minute chats × 2 simultaneous conversations
              </p>
            </div>
          </div>
        )}

        {phase === "countdown" && (
          <div className="animate-fade-in">
            <p className="text-gray-400 text-lg mb-6">Starting in</p>
            <div className="text-9xl font-bold text-white mb-6 animate-pulse">
              {countdown}
            </div>
            <p className="text-gray-400 text-sm">Get ready to chat!</p>
          </div>
        )}

        {phase === "ready" && (
          <div className="animate-fade-in">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-2xl font-bold text-white mb-2">Round Start!</h3>
            <p className="text-gray-400">Chat with your opponents</p>
          </div>
        )}
      </div>
    </div>
  );
}
