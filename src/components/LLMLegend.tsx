"use client";

import { AVAILABLE_MODELS } from "@/lib/openrouter";

interface LLMLegendProps {
  compact?: boolean;
  onSelect?: (modelId: string) => void;
  selectedModelId?: string;
  showHint?: boolean;
}

export default function LLMLegend({
  compact = false,
  onSelect,
  selectedModelId,
  showHint = false,
}: LLMLegendProps) {
  const models = AVAILABLE_MODELS;

  if (compact) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <p className="text-xs text-gray-400 mb-2">
          🤖 Bot Powering Models:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {models.slice(0, 4).map((model) => (
            <span
              key={model.id}
              onClick={() => onSelect?.(model.id)}
              className={`
                inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer
                transition-all duration-200
                ${selectedModelId === model.id
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
                  : "bg-slate-700/50 text-gray-300 border border-slate-600/50 hover:border-slate-500"
                }
              `}
            >
              {model.name.split(" ")[0]}
            </span>
          ))}
          {models.length > 4 && (
            <span className="text-xs text-gray-500">+{models.length - 4} more</span>
          )}
        </div>
        {showHint && (
          <p className="text-xs text-gray-500 mt-2">
            💡 Guess the LLM for bonus points!
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🤖</span>
        <h3 className="font-semibold text-white">Bot Powering Models</h3>
        <span className="text-xs text-gray-400 ml-auto">Free Tier</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => onSelect?.(model.id)}
            className={`
              relative p-3 rounded-lg text-left transition-all duration-200
              ${selectedModelId === model.id
                ? "bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-2 border-blue-500/50"
                : "bg-slate-700/30 border border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500"
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`font-medium ${selectedModelId === model.id ? "text-blue-200" : "text-gray-200"}`}>
                  {model.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{model.provider}</p>
              </div>
              {selectedModelId === model.id && (
                <span className="text-blue-400">✓</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 line-clamp-2">
              {model.description}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {model.characteristics.slice(0, 2).map((char) => (
                <span
                  key={char}
                  className="text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-gray-400"
                >
                  {char}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {showHint && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <p className="text-xs text-center text-gray-400">
            🎯 Guess the correct LLM for <span className="text-green-400 font-semibold">+5 bonus points</span>
          </p>
        </div>
      )}
    </div>
  );
}
