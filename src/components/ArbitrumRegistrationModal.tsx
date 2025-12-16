'use client';

import SpinningDetective from './SpinningDetective';

export type RegistrationStep = 'idle' | 'wallet-check' | 'signing' | 'confirming' | 'success' | 'error';

interface ArbitrumRegistrationModalProps {
  isVisible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  currentStep: RegistrationStep;
  error?: string | null;
  walletConnected?: boolean;
}

/**
 * Pre-registration modal for Arbitrum TX gating
 * 
 * DESIGN PRINCIPLES:
 * - Integrated into existing Detective design system (colors, spacing, animations)
 * - Clear progression through steps
 * - Helpful copy explaining what's happening
 * - Mobile-optimized
 * - Minimal but informative
 */
export default function ArbitrumRegistrationModal({
  isVisible,
  onConfirm,
  onCancel,
  currentStep = 'idle',
  error,
  walletConnected = false,
}: ArbitrumRegistrationModalProps) {
  if (!isVisible) return null;

  // Step configurations for consistent messaging
  const stepConfig = {
    'idle': {
      icon: '🔐',
      title: 'Secure Your Entry',
      description: 'Register with a one-time Arbitrum transaction for sybil resistance.',
      details: [
        '✓ Free registration (0 gas cost on Arbitrum)',
        '✓ One-time per cycle',
        '✓ Proves you\'re a real player',
      ],
      ctaLabel: 'Continue with Arbitrum',
      ctaPrimary: true,
      showWalletHint: true,
      showProgress: false,
    },
    'wallet-check': {
      icon: '👛',
      title: 'Connecting Wallet',
      description: 'Looking for your Arbitrum wallet...',
      details: [
        'If a popup doesn\'t appear, make sure MetaMask is installed',
        'You\'ll approve one transaction to register',
      ],
      ctaLabel: 'Waiting for wallet...',
      ctaPrimary: false,
      showWalletHint: false,
      showProgress: false,
    },
    'signing': {
      icon: '✍️',
      title: 'Sign Transaction',
      description: 'Please approve the transaction in your wallet.',
      details: [
        'Contract: DetectiveGameEntry',
        'Network: Arbitrum One',
        'Gas: ~$0.0001',
      ],
      ctaLabel: 'Waiting for signature...',
      ctaPrimary: false,
      showWalletHint: false,
      showProgress: false,
    },
    'confirming': {
      icon: '⛓️',
      title: 'Confirming on-chain',
      description: 'Your transaction is being confirmed...',
      details: [
        'This usually takes 10-30 seconds',
        'Please don\'t close this window',
      ],
      ctaLabel: 'Confirming...',
      ctaPrimary: false,
      showWalletHint: false,
      showProgress: true,
    },
    'success': {
      icon: '✨',
      title: 'Welcome to the Game!',
      description: 'Your entry is confirmed on-chain.',
      details: [
        '✓ Registration complete',
        '✓ You\'re ready to play',
      ],
      ctaLabel: 'Ready',
      ctaPrimary: true,
      showWalletHint: false,
      showProgress: false,
    },
    'error': {
      icon: '⚠️',
      title: 'Transaction Failed',
      description: error || 'Something went wrong. Please try again.',
      details: [
        'Make sure you have MetaMask installed',
        'Ensure you\'re on the Arbitrum network',
        'Check that you have enough funds',
      ],
      ctaLabel: 'Try Again',
      ctaPrimary: true,
      showWalletHint: false,
      showProgress: false,
    },
  };

  const config = stepConfig[currentStep];
  const isLoading = ['wallet-check', 'signing', 'confirming'].includes(currentStep);
  const isCompleted = currentStep === 'success';
  const isFailed = currentStep === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 max-w-sm w-full mx-4 pointer-events-auto border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          {/* Icon with animated state */}
          <div className={`text-5xl mb-4 inline-block ${
            isLoading ? 'animate-bounce' : isCompleted ? 'animate-pulse' : ''
          }`}>
            {config.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {config.title}
          </h2>

          {/* Description */}
          <p className="text-gray-400 text-sm md:text-base mb-4">
            {config.description}
          </p>
        </div>

        {/* Details List */}
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 mb-6 space-y-2">
          {config.details.map((detail, idx) => (
            <div key={idx} className="text-sm text-gray-300 flex gap-2">
              <span className="flex-shrink-0 text-gray-500">•</span>
              <span>{detail}</span>
            </div>
          ))}
        </div>

        {/* Progress Bar (for confirming step) */}
        {config.showProgress && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">Confirming on-chain</span>
              <span className="text-xs text-gray-400">⏳</span>
            </div>
            <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse" />
            </div>
          </div>
        )}

        {/* Wallet Hint (for idle step) */}
        {config.showWalletHint && (
          <div className={`rounded-lg p-3 mb-6 text-sm flex gap-3 ${
            walletConnected
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-yellow-500/10 border border-yellow-500/30'
          }`}>
            <span className="flex-shrink-0">
              {walletConnected ? '✓' : '⚠️'}
            </span>
            <span className={walletConnected ? 'text-green-300' : 'text-yellow-300'}>
              {walletConnected 
                ? 'MetaMask connected and ready'
                : 'Make sure MetaMask is installed and unlocked'}
            </span>
          </div>
        )}

        {/* Error State */}
        {isFailed && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-sm text-red-300 flex gap-3">
            <span className="flex-shrink-0">🔴</span>
            <div>
              <p className="font-medium">What went wrong?</p>
              <p className="text-xs text-red-200 mt-1">
                {error || 'The transaction was not confirmed on-chain.'}
              </p>
            </div>
          </div>
        )}

        {/* Loading Spinner (for loading states) */}
        {isLoading && (
          <div className="flex justify-center mb-6">
            <SpinningDetective size="sm" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary Action */}
          <button
            onClick={onConfirm}
            disabled={isLoading || (currentStep === 'idle' && !config.ctaPrimary)}
            className={`w-full px-6 py-3 rounded-lg font-bold transition-all duration-200 text-sm md:text-base touch-manipulation active:scale-[0.98] ${
              config.ctaPrimary && !isLoading
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/20'
                : isCompleted
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white'
                  : isLoading
                    ? 'bg-slate-700/50 text-gray-400 cursor-wait'
                    : isFailed
                      ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                      : 'bg-slate-700 text-gray-400 cursor-not-allowed'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {config.ctaLabel}
              </span>
            ) : (
              config.ctaLabel
            )}
          </button>

          {/* Cancel Button */}
           {!isLoading && !isCompleted && (
             <button
               onClick={onCancel}
               className="w-full px-6 py-3 rounded-lg font-medium transition-colors text-sm md:text-base border border-slate-600/50 hover:border-slate-500 text-gray-300 hover:text-white hover:bg-slate-800/50"
             >
               Cancel
             </button>
           )}
        </div>

        {/* Footer Info */}
        {currentStep === 'idle' && (
          <p className="text-xs text-gray-500 text-center mt-4">
            No entry fee. Your registration is recorded on Arbitrum for transparency.
          </p>
        )}

        {isCompleted && (
          <p className="text-xs text-green-400 text-center mt-4">
            ✓ You're now registered for this game cycle
          </p>
        )}
      </div>
    </div>
  );
}
