'use client';

import SpinningDetective from '../SpinningDetective';

/**
 * GameFinishedView - Transition state between game end and next cycle
 * 
 * Shows for ~5 seconds while server calculates final leaderboard
 * and prepares for next cycle. Users can view full results via
 * Stats toggle once back in REGISTRATION state.
 */
type Props = {
  onRequestRefresh?: (force?: boolean) => void;
};

export default function GameFinishedView({ onRequestRefresh }: Props) {
  return (
    <div className="w-full space-y-8 text-center py-12">
      {/* Spinning Detective */}
      <div className="flex justify-center">
        <SpinningDetective size="xl" />
      </div>

      {/* Status Message */}
      <div className="space-y-3">
        <h2 className="text-2xl font-black text-white">
          Game Complete! 🎉
        </h2>
        <p className="text-gray-400 text-sm">
          Calculating final results...
        </p>
      </div>

      {/* Hint */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm mx-auto">
        <p className="text-xs text-gray-400">
          💡 Use the <span className="text-white font-semibold">🏆 Stats</span> button to view your results
        </p>
      </div>

      {onRequestRefresh && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onRequestRefresh?.()}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-sm text-white font-semibold hover:bg-white/15 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
