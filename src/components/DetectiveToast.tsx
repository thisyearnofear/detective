'use client';

/**
 * Detective's Toast - Rotating trivia during briefing room waits
 * 
 * Features:
 * - Auto-rotates every 8 seconds
 * - Manual skip/next controls
 * - Fades out when user engages (registration, ready button)
 * - Smooth transitions
 */

import { useEffect, useState } from 'react';
import { getRandomTrivia, getCycleTriviaRotation, DETECTIVE_TRIVIA, TriviaItem } from '@/lib/detectiveTrivia';

type Props = {
  isVisible?: boolean;
  rotationInterval?: number; // ms between rotations (default 8000)
};

export default function DetectiveToast({
  isVisible = true,
  rotationInterval = 8000,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trivia, setTrivia] = useState<TriviaItem | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Initialize with random trivia
  useEffect(() => {
    setTrivia(getRandomTrivia());
  }, []);

  // Auto-rotate trivia
  useEffect(() => {
    if (!isVisible || hasUserInteracted) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % DETECTIVE_TRIVIA.length);
        setTrivia(getCycleTriviaRotation(currentIndex + 1));
        setIsTransitioning(false);
      }, 300); // Fade duration
    }, rotationInterval);

    return () => clearInterval(timer);
  }, [isVisible, hasUserInteracted, currentIndex, rotationInterval]);

  const handleNext = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % DETECTIVE_TRIVIA.length);
      setTrivia(getCycleTriviaRotation(currentIndex + 1));
      setIsTransitioning(false);
    }, 300);
  };

  const handlePrev = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + DETECTIVE_TRIVIA.length) % DETECTIVE_TRIVIA.length);
      setTrivia(getCycleTriviaRotation(currentIndex - 1));
      setIsTransitioning(false);
    }, 300);
  };

  const handleDismiss = () => {
    setHasUserInteracted(true);
  };

  if (!isVisible || !trivia || hasUserInteracted) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center pb-6 px-4 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Toast Container */}
        <div
          className={`
            max-w-2xl w-full
            bg-gradient-to-r from-slate-900/95 to-slate-800/95
            border border-white/15
            rounded-xl p-5 md:p-6
            backdrop-blur-lg
            shadow-2xl
            transition-all duration-300
            ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
          `}
        >
          {/* Content */}
          <div className="flex items-start gap-4 mb-4">
            {/* Icon */}
            <div className="text-3xl flex-shrink-0">{trivia.icon}</div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm md:text-base font-bold text-white mb-1">
                {trivia.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                {trivia.description}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Category Badge */}
            <span
              className={`
                text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full
                ${trivia.category === 'turing' && 'bg-blue-500/20 text-blue-300'}
                ${trivia.category === 'case' && 'bg-purple-500/20 text-purple-300'}
                ${trivia.category === 'ai-paradox' && 'bg-amber-500/20 text-amber-300'}
              `}
            >
              {trivia.category === 'turing' && '🤖 Turing Theory'}
              {trivia.category === 'case' && '🔍 Detective Lore'}
              {trivia.category === 'ai-paradox' && '⚡ AI Insight'}
            </span>

            {/* Navigation & Dismiss */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="text-xs px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Previous trivia"
              >
                ← Prev
              </button>

              <span className="text-xs text-gray-500 px-1">
                {currentIndex + 1}/{DETECTIVE_TRIVIA.length}
              </span>

              <button
                onClick={handleNext}
                className="text-xs px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Next trivia"
              >
                Next →
              </button>

              <button
                onClick={handleDismiss}
                className="text-xs px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors ml-1"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Hint Text */}
        <p className="text-xs text-gray-600 text-center mt-2">
          Auto-rotates • Click action buttons to interact
        </p>
      </div>
    </div>
  );
}
