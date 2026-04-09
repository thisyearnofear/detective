'use client';

type EmptyStateVariant = 
  | 'waiting-opponent'
  | 'loading'
  | 'error'
  | 'no-matches'
  | 'searching';

type Props = {
  variant: EmptyStateVariant;
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

const variants = {
  'waiting-opponent': {
    icon: '🔍',
    defaultTitle: 'Searching for suspects...',
    defaultMessage: 'Finding you a worthy opponent',
    animation: 'animate-pulse',
  },
  'loading': {
    icon: '🕵️',
    defaultTitle: 'Analyzing clues...',
    defaultMessage: 'Preparing your investigation',
    animation: 'animate-spin',
  },
  'error': {
    icon: '🚨',
    defaultTitle: 'Case file corrupted',
    defaultMessage: 'Something went wrong with the investigation',
    animation: '',
  },
  'no-matches': {
    icon: '📋',
    defaultTitle: 'No active cases',
    defaultMessage: 'All investigations have been solved',
    animation: '',
  },
  'searching': {
    icon: '🔎',
    defaultTitle: 'Gathering evidence...',
    defaultMessage: 'Building your case file',
    animation: 'animate-bounce',
  },
};

/**
 * EmptyState - Personality-filled empty states
 * 
 * Replaces bland "loading" and "waiting" messages with
 * detective-themed, engaging feedback
 */
export default function EmptyState({ variant, title, message, action }: Props) {
  const config = variants[variant];

  return (
    <div className="bg-slate-800/50 rounded-lg p-8 text-center border-2 border-dashed border-slate-700">
      <div className={`text-6xl mb-4 ${config.animation}`}>
        {config.icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">
        {title || config.defaultTitle}
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        {message || config.defaultMessage}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
