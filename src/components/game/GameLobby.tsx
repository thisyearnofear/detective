'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Player, UserProfile } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';
import { useRegistrationFlow } from '@/hooks/useRegistrationFlow';
import { fetcher } from '@/lib/fetcher';
import { GAME_CONSTANTS } from '@/lib/gameConstants';
import Lobby from './phases/Lobby';
import ErrorCard from '../ErrorCard';
import ArbitrumRegistrationModal from '../ArbitrumRegistrationModal';

type Props = {
  currentPlayer: UserProfile;
  isRegistrationOpen?: boolean;
  gameState: any;
};

export default function GameLobby({ currentPlayer, isRegistrationOpen = true, gameState }: Props) {
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
    console.log('[GameLobby] Register initiated for FID:', currentPlayer.fid);
    
    // Store FID in localStorage for the flow hook to use
    localStorage.setItem('userFid', currentPlayer.fid.toString());
    
    // Show modal and execute registration flow
    setShowRegistrationModal(true);
    setError(null);

    // Execute the wallet + TX flow
    const txHash = await flow.executeRegistration(() => {
      setIsLoading(true);
    });

    if (!txHash) {
      // Flow hook will have set the error state
      setIsLoading(false);
      return;
    }

    try {
      // Step 2: Send registration request with TX hash
      console.log('[GameLobby] Sending registration request with TX:', txHash);
      const arbitrumWalletAddress = localStorage.getItem('arbitrumWalletAddress');
      
      const registrationBody: any = { fid: currentPlayer.fid };
      
      if (txHash && arbitrumWalletAddress) {
        registrationBody.arbitrumTxHash = txHash;
        registrationBody.arbitrumWalletAddress = arbitrumWalletAddress;
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

      console.log('[GameLobby] Registration response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[GameLobby] Registration error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      console.log('[GameLobby] Registration success:', data);
      setIsRegistered(true);
      
      // Keep modal visible briefly to show success, then close
      setTimeout(() => {
        setShowRegistrationModal(false);
      }, 1500);
    } catch (err: any) {
      console.error('[GameLobby] Registration error:', err);
      setError(err.name === 'TimeoutError' ? 'Registration timed out. Please try again.' : err.message);
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
        title="Game Connection Lost"
        message="Unable to connect to game server. Please refresh."
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

  // Only show Lobby during REGISTRATION - parent GameStateView will switch to GameActiveView when LIVE
  return (
    <>
      <Lobby
        currentPlayer={currentPlayer}
        registeredPlayers={registeredPlayers}
        maxPlayers={maxPlayers}
        timeLeft={timeLeft}
        isRegistered={isRegistered}
        isLoading={isLoading}
        error={error}
        onRegister={handleRegister}
        onReady={handleReady}
      />

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
