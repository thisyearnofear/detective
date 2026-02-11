"use client";

import { useEffect, useState } from "react";
import { AVAILABLE_MODELS } from "@/lib/openrouter";

interface VoteToggleProps {
  currentVote: "REAL" | "BOT";
  onToggle: () => void;
  onLlmGuess?: (modelId: string) => void;
  isLocked?: boolean;
  showAnimation?: boolean;
  isCompact?: boolean;
  voteResult?: "correct" | "incorrect" | null;
  secondsRemaining?: number;
  isBotMatch?: boolean;
  selectedLlmId?: string;
}

export default function VoteToggle({
  currentVote,
  onToggle,
  onLlmGuess,
  isLocked = false,
  showAnimation = true,
  isCompact = false,
  voteResult = null,
  secondsRemaining,
  isBotMatch = false,
  selectedLlmId,
}: VoteToggleProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [lockAnimating, setLockAnimating] = useState(false);
  const [showLlmDropdown, setShowLlmDropdown] = useState(false);

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

  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === selectedLlmId);

  return (
    <div className="flex flex-col items-center gap-3">
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
          ${lockAnimating ? "animate-vote-lock" : ""}
          ${voteResult === "correct" ? "animate-vote-correct" : ""}
          ${voteResult === "incorrect" ? "animate-vote-incorrect" : ""}
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

      {/* LLM Guess Section - Only for Bot matches */}
      {isBotMatch && !isLocked && (
        <div className="w-full max-w-xs">
          <button
            onClick={() => setShowLlmDropdown(!showLlmDropdown)}
            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-left hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎯</span>
                <span className={`text-sm ${selectedLlmId ? "text-white" : "text-gray-400"}`}>
                  {selectedModel ? selectedModel.name : "Guess the LLM (+5 pts)"}
                </span>
              </div>
              <span className={`text-gray-500 transition-transform ${showLlmDropdown ? "rotate-180" : ""}`}>
                ▼
              </span>
            </div>
          </button>

          {showLlmDropdown && (
            <div className="mt-2 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden animate-fade-in">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onLlmGuess?.(model.id);
                    setShowLlmDropdown(false);
                  }}
                  className={`
                    w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors
                    ${selectedLlmId === model.id ? "bg-blue-900/30 text-blue-200" : "text-gray-200"}
                  `}
                >
                  <span className="text-gray-500 text-xs w-20 truncate">{model.name}</span>
                  <span className="text-gray-500 text-xs">•</span>
                  <span className="text-gray-400 text-xs">{model.provider}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected LLM Display */}
      {isBotMatch && selectedLlmId && !isLocked && (
        <div className="flex items-center gap-1.5 text-xs text-blue-400">
          <span>🎯</span>
          <span>Guessing: {selectedModel?.name}</span>
        </div>
      )}

      {/* Timer Warning - Critical State (< 3s) */}
      {secondsRemaining !== undefined && secondsRemaining > 0 && secondsRemaining <= 3 && !isLocked && (
        <div className={`${textSize} text-red-400 font-bold text-center animate-pulse`}>
          🔒 LOCKING IN {secondsRemaining}s
        </div>
      )}

      {/* Timer Warning - Yellow Alert (< 10s) */}
      {secondsRemaining !== undefined && secondsRemaining > 3 && secondsRemaining <= 10 && !isLocked && (
        <div className={`${textSize} text-yellow-400 text-center`}>
          ⚠️ {secondsRemaining} seconds to lock
        </div>
      )}

      {/* Hint Text */}
      {!hasInteracted && !isLocked && (secondsRemaining === undefined || secondsRemaining > 10) && (
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

      {/* Vote Result Feedback */}
      {voteResult === "correct" && (
        <div className={`${textSize} text-green-400 flex items-center gap-1 animate-vote-feedback`}>
          <span>✓</span>
          <span>Correct vote!</span>
          {selectedLlmId && (
            <span className="text-blue-300 ml-1">+5 LLM bonus!</span>
          )}
        </div>
      )}
      {voteResult === "incorrect" && (
        <div className={`${textSize} text-red-400 flex items-center gap-1 animate-vote-feedback`}>
          <span>✗</span>
          <span>Better luck next time</span>
        </div>
      )}

      {/* Locked State Indicator */}
      {isLocked && !voteResult && (
        <div className={`${textSize} text-gray-500 flex items-center gap-1`}>
          <span>🔒</span>
          <span>Vote locked</span>
          {selectedLlmId && selectedModel && (
            <span className="text-blue-300 ml-1">• Guessed: {selectedModel.name}</span>
          )}
        </div>
      )}
    </div>
  );
}
