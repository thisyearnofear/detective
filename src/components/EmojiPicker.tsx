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
  };

  const handleTextClick = (text: string) => {
    onEmojiSelect(text + " ");
    setIsOpen(false);
  };

  const buttonSize = isCompact ? "p-2" : "p-2.5";

  return (
    <div className="relative">
      {/* Emoji trigger button - improved styling */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonSize} rounded-xl bg-slate-700/80 border border-slate-600 
          hover:bg-slate-600 hover:border-slate-500 text-gray-300 hover:text-white 
          transition-all duration-200 ${isOpen ? "bg-slate-600 text-white ring-2 ring-blue-500 border-transparent" : ""
          }`}
        title="Add emoji"
      >
        <span className={isCompact ? "text-lg" : "text-xl"}>
          {isOpen ? "✕" : "😀"}
        </span>
      </button>

      {/* Picker panel - centered above button */}
      {isOpen && (
        <div
          className={`absolute z-20 bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl 
            border border-slate-600/50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200
            ${isCompact ? "w-[280px]" : "w-[320px]"}`}
          style={{
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
          }}
        >
          {/* Tab buttons */}
          <div className="flex gap-2 mb-4 justify-center">
            <button
              onClick={() => setShowShortcuts(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${!showShortcuts
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                  : "bg-slate-700 text-gray-400 hover:text-white hover:bg-slate-600"
                }`}
            >
              😀 Emojis
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${showShortcuts
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                  : "bg-slate-700 text-gray-400 hover:text-white hover:bg-slate-600"
                }`}
            >
              ⌨️ Shortcuts
            </button>
          </div>

          {/* Emoji grid - 6 columns for better mobile fit */}
          {!showShortcuts && (
            <>
              <div className="grid grid-cols-6 gap-1">
                {FARCASTER_EMOJIS.map((item) => (
                  <button
                    key={item.shortcode}
                    onClick={() => handleEmojiClick(item.emoji)}
                    className="p-2.5 rounded-xl hover:bg-slate-700 active:scale-90 
                      transition-all duration-150 text-xl leading-none flex items-center justify-center"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                Tap to insert • Multiple allowed
              </p>
            </>
          )}

          {/* Text shortcuts */}
          {showShortcuts && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {TEXT_SHORTCUTS.map((item) => (
                  <button
                    key={item.text}
                    onClick={() => handleTextClick(item.text)}
                    className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 
                      active:scale-95 transition-all duration-150 text-sm font-mono 
                      text-gray-200 hover:text-white"
                    title={item.label}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                Farcaster culture phrases
              </p>
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
