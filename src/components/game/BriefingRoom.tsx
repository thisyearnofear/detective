'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player, UserProfile } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';
import { useRegistrationFlow } from '@/hooks/useRegistrationFlow';
import { fetcher } from '@/lib/fetcher';
import { GAME_CONSTANTS } from '@/lib/gameConstants';
import ErrorCard from '../ErrorCard';
import ArbitrumRegistrationModal from '../ArbitrumRegistrationModal';
import DetectiveToast from '../DetectiveToast';

type Props = {
  currentPlayer: UserProfile;
  isRegistrationOpen?: boolean;
  gameState: any;
};

export default function BriefingRoom({ currentPlayer, isRegistrationOpen = true, gameState }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(gameState?.isRegistered || false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Registration flow management
  const flow = useRegistrationFlow();

  // Consolidated polling: single endpoint for game state, phase, and players
  // Reduces 2 requests/2s to 1 request/2s
  const { data: statusData } = useSWR(
    gameState?.cycleId ? `/api/game/status?cycleId=${gameState.cycleId}&fid=${currentPlayer.fid}` : null,
    fetcher,
    {
      refreshInterval: 2000, // Poll every 2s for phase changes + player updates
      revalidateOnFocus: true, // Mobile: Refresh when user returns
      shouldRetryOnError: true,
      errorRetryInterval: 1000,
    }
  );

  const registeredPlayers = (statusData?.players || []) as Player[];
  const maxPlayers = GAME_CONSTANTS.MAX_PLAYERS;

  // Use countdown hook for timer (syncs with server)
  const countdownEndTime = statusData?.phaseEndTime || gameState?.registrationEnds || 0;
  const { timeRemaining } = useCountdown({
    endTime: countdownEndTime,
    pollInterval: 100, // Smooth updates
  });

  // Update timeLeft state for Lobby component
  useEffect(() => {
    setTimeLeft(timeRemaining);
  }, [timeRemaining]);

  const handleRegister = async () => {
    console.log('[BriefingRoom] Join investigation initiated for FID:', currentPlayer.fid);

    // Store FID in localStorage for the flow hook to use
    localStorage.setItem('userFid', currentPlayer.fid.toString());

    // Show modal and execute registration flow
    setShowRegistrationModal(true);
    setError(null);

    // Execute the wallet + TX flow
    const flowResult = await flow.executeRegistration(
      () => {
        setIsLoading(true);
      },
      { 
        skipPermissions: statusData?.config && !statusData.config.monetizationEnabled 
      }
    );

    if (!flowResult) {
      // Flow hook will have set the error state
      setIsLoading(false);
      return;
    }

    const { txHash, permissions } = flowResult;

    try {
      // Step 2: Send registration request with TX hash and permissions
      console.log('[BriefingRoom] Sending investigation join request with TX:', txHash);
      const arbitrumWalletAddress = localStorage.getItem('arbitrumWalletAddress');

      const registrationBody: any = { fid: currentPlayer.fid };

      if (txHash && arbitrumWalletAddress) {
        registrationBody.arbitrumTxHash = txHash;
        registrationBody.arbitrumWalletAddress = arbitrumWalletAddress;
      }

      // Add session permissions if granted
      if (permissions?.hasPermission) {
        registrationBody.hasPermission = true;
        registrationBody.permissionExpiry = permissions.expiry;
      }

      const response = await fetch('/api/game/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(registrationBody),
        signal: AbortSignal.timeout(15000),
      });

      console.log('[BriefingRoom] Investigation join response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[BriefingRoom] Investigation join error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Investigation join failed: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.error || 'Investigation join failed');
      }

      const data = await response.json();
      console.log('[BriefingRoom] Investigation join success:', data);
      setIsRegistered(true);

      // Keep modal visible briefly to show success, then close
      setTimeout(() => {
        setShowRegistrationModal(false);
      }, 1500);
    } catch (err: any) {
      console.error('[BriefingRoom] Investigation join error:', err);
      setError(err.name === 'TimeoutError' ? 'Investigation join timed out. Please try again.' : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReady = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/game/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: currentPlayer.fid }),
      });

      if (!response.ok) {
        throw new Error('Failed to set ready status');
      }

      // Optimistic update or wait for SWR revalidation
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRegistrationOpen) {
    return null;
  }

  // Show error if status endpoint failed
  if (error) {
    return (
      <ErrorCard
        title="Connection Lost"
        message="Unable to connect to the investigation. Please refresh."
        severity="error"
        icon="🔌"
        onDismiss={() => window.location.reload()}
      />
    );
  }

  const handleModalConfirm = () => {
    if (flow.currentStep === 'error') {
      // Retry: reset and try again
      flow.reset();
      handleRegister();
    } else if (flow.currentStep === 'success') {
      // Close modal after success
      setShowRegistrationModal(false);
    }
  };

  const handleModalCancel = () => {
    setShowRegistrationModal(false);
    flow.reset();
  };

  // Calculate helper variables
  const spotsLeft = maxPlayers - registeredPlayers.length;
  const isFull = spotsLeft === 0;
  const hasMinPlayers = registeredPlayers.length >= GAME_CONSTANTS.MIN_PLAYERS;
  const countdownActive = hasMinPlayers && timeLeft < 999999999; // Countdown started

  const formatTimeLeft = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  // Only show Briefing Room during REGISTRATION - parent GameStateView will switch to GameActiveView when LIVE
  return (
    <>
      {/* Detective Toast - Rotating trivia during briefing wait */}
      <DetectiveToast isVisible={isRegistrationOpen} />

      {/* Registration Status Header */}
      <div className="text-center">
        <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke mb-2">
          Briefing Room
        </h2>
        <p className="text-gray-400 text-xs md:text-sm">
          {isFull ? 'Briefing Room is full!' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`}
        </p>
      </div>

      {/* Registration Progress */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <span className="text-xs md:text-sm font-medium text-white">Detectives Registered</span>
          <span className="text-xs md:text-sm font-bold text-blue-400">{registeredPlayers.length}/{maxPlayers}</span>
        </div>
        <div className="w-full bg-slate-700/50 h-2 md:h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${(registeredPlayers.length / maxPlayers) * 100}%` }}
          />
        </div>
      </div>

      {/* Game Status - Conditional based on detective count */}
      {!hasMinPlayers ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 text-center backdrop-blur-sm">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Waiting for Detectives</span>
          <div className="text-2xl md:text-3xl font-bold text-white mt-2">
            {GAME_CONSTANTS.MIN_PLAYERS - registeredPlayers.length} more needed
          </div>
          <p className="text-xs text-gray-500 mt-2">Investigation starts when {GAME_CONSTANTS.MIN_PLAYERS}+ detectives join</p>
        </div>
      ) : countdownActive ? (
        <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-2 border-green-500/30 rounded-xl p-4 md:p-6 text-center backdrop-blur-sm animate-pulse">
          <span className="text-xs text-green-300 uppercase tracking-wide font-bold">🚀 Starting Soon!</span>
          <div className="text-4xl md:text-5xl font-black text-white mt-2">
            {formatTimeLeft(timeLeft)}
          </div>
          <p className="text-xs text-gray-300 mt-2">Last chance to join!</p>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 text-center backdrop-blur-sm">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Ready to Start</span>
          <div className="text-2xl md:text-3xl font-bold text-green-400 mt-2">
            ✓ {registeredPlayers.length} Detectives
          </div>
          <p className="text-xs text-gray-500 mt-2">Waiting for all detectives to ready up</p>
        </div>
      )}

      {/* Registered Players List */}
      {registeredPlayers.length > 0 && (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
          <h3 className="font-bold text-white mb-4 text-sm md:text-base">Registered Detectives</h3>
          <div className="space-y-2">
            {registeredPlayers.map((detective: Player) => (
              <div
                key={detective.fid}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {detective.username.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">@{detective.username}</div>
                    <div className="text-xs text-gray-500">{detective.displayName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {detective.fid === currentPlayer.fid && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                      You
                    </span>
                  )}
                  {detective.isReady && (
                    <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30">
                      Ready
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registration Button - Mobile optimized */}
      {!isRegistered ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Join investigation button clicked'); // Debug log
            handleRegister();
          }}
          disabled={isLoading || isFull}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm md:text-base touch-manipulation active:scale-[0.98] min-h-[44px]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {isLoading ? 'Joining...' : isFull ? 'Briefing Room Full' : 'Join Investigation'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center text-green-300 text-sm">
            ✅ You're registered!
          </div>

          {registeredPlayers.length >= 4 && (
            <div className="animate-fade-in">
              {registeredPlayers.find((p: Player) => p.fid === currentPlayer.fid)?.isReady ? (
                <div className="w-full px-6 py-4 bg-slate-700/50 border border-slate-600 rounded-lg text-center text-gray-300 font-bold">
                  Waiting for other detectives...
                </div>
              ) : (
                <button
                  onClick={handleReady}
                  disabled={isLoading}
                  className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20 animate-pulse"
                >
                  {isLoading ? 'Setting Ready...' : 'Ready to Start!'}
                </button>
              )}
              <p className="text-xs text-center text-gray-500 mt-2">
                Investigation starts when all detectives are ready (min 4)
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-200 text-sm text-center backdrop-blur-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Registration Flow Modal */}
      <ArbitrumRegistrationModal
        isVisible={showRegistrationModal}
        currentStep={flow.currentStep}
        error={flow.error}
        walletConnected={flow.walletConnected}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </>
  );
}
