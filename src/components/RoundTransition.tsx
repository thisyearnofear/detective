"use client";

import { useEffect, useState } from "react";

interface RoundTransitionProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export default function RoundTransition({
  isVisible,
  onComplete,
}: RoundTransitionProps) {
  const [phase, setPhase] = useState<"exit" | "transition" | "enter">("exit");

  useEffect(() => {
    if (!isVisible) {
      setPhase("exit");
      return;
    }

    // Exit phase (current content fades out and scales down)
    setPhase("exit");
    const exitTimer = setTimeout(() => {
      setPhase("transition");
    }, 300);

    // Transition phase (background color shift)
    const transitionTimer = setTimeout(() => {
      setPhase("enter");
    }, 600);

    // Enter phase completes
    const enterTimer = setTimeout(() => {
      onComplete?.();
    }, 900);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(transitionTimer);
      clearTimeout(enterTimer);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* Fade overlay during transition */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          phase === "transition" ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.8))",
        }}
      />

      {/* Center glow effect */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
          phase === "transition" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 blur-3xl" />
      </div>

      {/* Exiting content shrink */}
      {phase === "exit" && (
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{
            transform: "scale(0.98)",
            opacity: 0,
          }}
        />
      )}

      {/* Entering content grow */}
      {phase === "enter" && (
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{
            transform: "scale(1)",
            opacity: 1,
          }}
        />
      )}

      {/* Animated progress indicator */}
      <div className="absolute bottom-1/2 left-1/2 transform -translate-x-1/2 translate-y-1/2">
        <div className={`transition-opacity duration-300 ${
          phase === "transition" ? "opacity-100" : "opacity-0"
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "0.1s" }} />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
