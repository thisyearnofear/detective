"use client";

import { useState } from "react";
import { FARCASTER_EMOJIS, TEXT_SHORTCUTS } from "@/lib/constants";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isCompact?: boolean;
}

export default function EmojiPicker({
  onEmojiSelect,
  isCompact = false,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    // Keep picker open for multiple selections
    // User can close by clicking the button again
  };

  const handleTextClick = (text: string) => {
    onEmojiSelect(text + " ");
    setIsOpen(false);
  };

  const buttonSize = isCompact ? "p-1.5" : "p-2";
  const pickerPosition = isCompact ? "bottom-10 right-0" : "bottom-12 right-0";

  return (
    <div className="relative">
      {/* Emoji button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonSize} rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white transition-all ${isOpen ? "bg-slate-600 text-white ring-2 ring-blue-500" : ""
          }`}
        title="Add emoji"
      >
        <span className={isCompact ? "text-sm" : "text-base"}>
          {isOpen ? "✕" : "🦄"}
        </span>
      </button>

      {/* Picker panel */}
      {isOpen && (
        <div
          className={`absolute ${pickerPosition} z-20 bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-3 min-w-[280px] animate-in fade-in slide-in-from-bottom-2 duration-200`}
        >
          {/* Tab buttons */}
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setShowShortcuts(false)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${!showShortcuts
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-400 hover:text-white"
                }`}
            >
              Emojis
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${showShortcuts
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-400 hover:text-white"
                }`}
            >
              Shortcuts
            </button>
          </div>

          {/* Emoji grid */}
          {!showShortcuts && (
            <>
              <div className="grid grid-cols-8 gap-1 mb-2">
                {FARCASTER_EMOJIS.map((item) => (
                  <button
                    key={item.shortcode}
                    onClick={() => handleEmojiClick(item.emoji)}
                    className="p-2 rounded hover:bg-slate-700 transition-colors text-lg leading-none"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 text-center">
                Click to insert • Click multiple for more
              </div>
            </>
          )}

          {/* Text shortcuts */}
          {showShortcuts && (
            <>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {TEXT_SHORTCUTS.map((item) => (
                  <button
                    key={item.text}
                    onClick={() => handleTextClick(item.text)}
                    className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors text-sm font-mono"
                    title={item.label}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 text-center">
                Common Farcaster phrases
              </div>
            </>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
