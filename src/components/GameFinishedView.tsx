'use client';

import { useState, useCallback } from 'react';
import SpinningDetective from './SpinningDetective';
import { useCountdown } from '@/hooks/useCountdown';
import {
  getAchievements,
  getMotivationMessage,
  formatEarnings,
  generateShareText,
  type GameResult,
} from '@/lib/gamification';

interface GameFinishedViewProps {
  onRequestRefresh?: (force?: boolean) => void;
  gameResult?: GameResult;
  nextRegistrationTime?: number;
  onPlayAgain?: () => void;
}

export default function GameFinishedView({
  onRequestRefresh,
  gameResult,
  nextRegistrationTime,
  onPlayAgain,
}: GameFinishedViewProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const countdown = useCountdown({
    endTime: nextRegistrationTime || 0,
  });

  const handleShare = useCallback(async () => {
    if (!gameResult) return;

    setIsSharing(true);
    try {
      const shareText = generateShareText(gameResult, getAchievements(gameResult));

      if (navigator.share) {
        await navigator.share({
          title: 'Detective Game Results',
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setIsSharing(false);
    }
  }, [gameResult]);

  const achievements = gameResult ? getAchievements(gameResult) : [];
  const motivation = gameResult ? getMotivationMessage(gameResult.accuracy) : '';

  return (
    <div className="w-full space-y-6 text-center py-8">
      {/* Hero Animation */}
      <div className="flex justify-center mb-6">
        <SpinningDetective size="xl" />
      </div>

      {/* Celebration Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-white">Case Closed! 🎉</h2>
        {gameResult && (
          <p className="text-lg font-bold text-purple-300">{gameResult.accuracy.toFixed(0)}% Accuracy</p>
        )}
      </div>

      {/* Results Preview (collapsible) */}
      {gameResult && (
        <div className="max-w-sm mx-auto">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full py-3 px-4 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-gray-300 hover:bg-slate-800 transition-colors"
          >
            {showDetails ? 'Hide Results' : 'Show Results Preview'}
          </button>

          {showDetails && (
            <div className="mt-4 space-y-4 animate-fade-in">
              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xl font-bold text-yellow-400">#{gameResult.rank}</div>
                  <div className="text-xs text-gray-400">Rank</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xl font-bold text-green-400">{gameResult.correctCount}/{gameResult.totalCount}</div>
                  <div className="text-xs text-gray-400">Correct</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xl font-bold text-blue-400">{gameResult.streak}</div>
                  <div className="text-xs text-gray-400">Streak</div>
                </div>
              </div>

              {/* Earnings */}
              {gameResult.earnings > 0 && (
                <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-400">{formatEarnings(gameResult.earnings)}</div>
                  <div className="text-xs text-green-300">Earned from stakes</div>
                </div>
              )}

              {/* Achievements */}
              {achievements.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-gray-400 mb-2">🏅 Achievements</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {achievements.slice(0, 5).map((achievement) => (
                      <span
                        key={achievement.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded text-xs"
                        title={achievement.description}
                      >
                        <span>{achievement.icon}</span>
                        <span className="text-gray-200">{achievement.name}</span>
                      </span>
                    ))}
                    {achievements.length > 5 && (
                      <span className="text-xs text-gray-400">+{achievements.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Motivation Message */}
      {motivation && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-sm text-gray-300">{motivation}</p>
        </div>
      )}

      {/* Countdown Timer */}
      {!countdown.isExpired && (
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-xs text-gray-400 mb-1">Next registration opens in</p>
          <p className="text-2xl font-black text-blue-300">{countdown.formattedTime}</p>
        </div>
      )}

      {/* Share Button */}
      {gameResult && (
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          {isSharing ? 'Sharing...' : '📤 Share Results'}
        </button>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <button
          onClick={onPlayAgain}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
        >
          {countdown.isExpired ? 'Play Again' : 'Join Next Investigation'}
        </button>

        <button
          onClick={() => onRequestRefresh?.(true)}
          className="py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          View Full Leaderboard
        </button>
      </div>

      {/* Hint */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 max-w-xs mx-auto">
        <p className="text-xs text-gray-400">
          💡 Tip: Your results are saved automatically. Come back when registration opens!
        </p>
      </div>
    </div>
  );
}
