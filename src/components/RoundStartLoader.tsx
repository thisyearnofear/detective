"use client";

import { useEffect, useState } from "react";

interface RoundStartLoaderProps {
  isVisible: boolean;
  currentRound?: number;
  totalRounds?: number;
  onComplete?: () => void;
}

export default function RoundStartLoader({
  isVisible,
  currentRound = 1,
  totalRounds = 5,
  onComplete,
}: RoundStartLoaderProps) {
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<"preparing" | "countdown" | "ready">("preparing");

  useEffect(() => {
    if (!isVisible) {
      setCountdown(3);
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
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        {phase === "preparing" && (
          <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-4">
              Preparing Round {currentRound}
            </h2>
            <p className="text-gray-400 mb-4">
              {currentRound} of {totalRounds} • Finding your opponents...
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
