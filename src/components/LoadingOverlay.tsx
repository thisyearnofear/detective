// src/components/LoadingOverlay.tsx
'use client';

import SpinningDetective from './SpinningDetective';

export type LoadingVariant = 'registration' | 'round-start' | 'preparing' | 'reveal' | 'generic';

interface LoadingOverlayProps {
  variant?: LoadingVariant;
  message?: string;
  subtext?: string;
  progress?: number; // 0-100 for progress bar
  inline?: boolean; // If true, renders as inline block (no fixed positioning)
  isVisible?: boolean; // For conditional rendering
}

const variantConfig: Record<LoadingVariant, { icon: string; defaultMessage: string; color: string }> = {
  registration: {
    icon: '🎮',
    defaultMessage: 'Joining game...',
    color: 'blue',
  },
  'round-start': {
    icon: '⏱️',
    defaultMessage: 'Preparing round...',
    color: 'purple',
  },
  preparing: {
    icon: '⏳',
    defaultMessage: 'Preparing...',
    color: 'purple',
  },
  reveal: {
    icon: '🎯',
    defaultMessage: 'Revealing results...',
    color: 'green',
  },
  generic: {
    icon: '⏳',
    defaultMessage: 'Loading...',
    color: 'blue',
  },
};

export default function LoadingOverlay({
  variant = 'generic',
  message,
  subtext,
  progress,
  inline = false,
  isVisible = true,
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  const config = variantConfig[variant];
  const displayMessage = message || config.defaultMessage;

  const content = (
    <div className="text-center space-y-4">
      <SpinningDetective size="lg" className="mb-2" />
      <div>
        <h2 className="text-xl font-bold text-white mb-1">{displayMessage}</h2>
        {subtext && <p className="text-sm text-gray-400">{subtext}</p>}
      </div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="w-full bg-slate-700/50 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${
              config.color === 'blue'
                ? 'from-blue-500 to-blue-600'
                : config.color === 'purple'
                  ? 'from-purple-500 to-purple-600'
                  : 'from-green-500 to-green-600'
            } transition-all duration-300`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );

  if (inline) {
    // Inline version for embedding in existing layouts
    return (
      <div className="flex items-center justify-center p-8 bg-slate-900/30 border border-slate-700 rounded-xl">
        {content}
      </div>
    );
  }

  // Fixed positioning overlay
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none">
      <div className="bg-slate-900 rounded-2xl p-8 max-w-sm pointer-events-auto border border-slate-700/50 shadow-2xl">
        {content}
      </div>
    </div>
  );
}
