"use client";

import { GameMode } from "@/lib/types";
import { getModeName, getModeDescription, getModeIcon } from "@/lib/gameMode";

type Props = {
  currentMode: GameMode;
  selectedMode?: GameMode;
  onModeSelect?: (mode: GameMode) => void;
  disabled?: boolean;
};

/**
 * ModeSelector - Choose between conversation and negotiation modes
 * 
 * CLEAN: Reusable component for mode selection
 * MODULAR: Uses gameMode utilities for display
 * 
 * Shows current mode with clear visual indicator
 * Only allows selection when onModeSelect is provided
 */
export default function ModeSelector({
  currentMode,
  selectedMode,
  onModeSelect,
  disabled = false,
}: Props) {
  const modes: GameMode[] = ['conversation', 'negotiation'];
  const activeMode = selectedMode || currentMode;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 uppercase tracking-widest">
          Game Mode
        </div>
        {!onModeSelect && (
          <div className="text-xs text-green-400 flex items-center gap-1">
            <span>✓</span>
            <span>Active</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => {
          const isActive = activeMode === mode;
          const isCurrent = currentMode === mode;
          const icon = getModeIcon(mode);
          const name = getModeName(mode);
          const description = getModeDescription(mode);
          
          return (
            <button
              key={mode}
              onClick={() => !disabled && onModeSelect?.(mode)}
              disabled={disabled}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-300 text-left
                ${isActive 
                  ? 'bg-purple-900/40 border-purple-500/60 shadow-lg shadow-purple-500/20' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Current game mode badge */}
              {isCurrent && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-[10px] text-green-400 font-semibold">
                  ACTIVE
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <div className="text-3xl">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm mb-1">
                    {name}
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed">
                    {description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {!onModeSelect && (
        <div className="text-xs text-gray-500 text-center bg-slate-800/30 rounded-lg p-2">
          💡 Mode is set for this game cycle
        </div>
      )}
    </div>
  );
}
