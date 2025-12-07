"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import useSWR from "swr";
import ChatWindow from "./ChatWindow";
import Leaderboard from "./Leaderboard";
import LoadingOverlay from "./LoadingOverlay";
import { useModal } from "@/hooks/useModal";
import { fetcherWithGameNotLive } from "@/lib/fetcher";
import { syncTimeOffset, resetTimeOffset } from "@/lib/timeSynchronization";
import { UserProfile } from "@/lib/types";

// Polling intervals - single source of truth
const POLLING_INTERVALS = {
  ACTIVE_GAME: 2000,      // Normal active game polling
  ROUND_TRANSITION: 500,  // Fast polling during round transitions
  POST_GAME_WAIT: 1000,   // Minimal polling while waiting for next cycle (detects cycleId change)
} as const;

type Props = {
  fid: number;
};

type VoteState = Record<string, "REAL" | "BOT">;

type RoundResult = {
  roundNumber: number;
  correct: boolean;
  opponentUsername: string;
  opponentType: "REAL" | "BOT";
  opponentFid: number;
};

export default function MultiChatContainer({ fid }: Props) {
  const { show: showModal } = useModal();
  const [votes, setVotes] = useState<VoteState>({});
  const [newMatchIds, setNewMatchIds] = useState<Set<string>>(new Set());
  const [gameFinished, setGameFinished] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [batchReveals, setBatchReveals] = useState<Array<{
    opponent: UserProfile;
    actualType: "REAL" | "BOT";
  }>>([]);
  // Track if we've ever successfully loaded matches (to prevent premature error display)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  // Track round transitions for loading state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastRound, setLastRound] = useState(0);
  const [transitionTimeoutMessage, setTransitionTimeoutMessage] = useState<"preparing" | "delayed" | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transitionWarningRef = useRef<NodeJS.Timeout | null>(null);
  const [isPreparingRound, setIsPreparingRound] = useState(false);

  // Track last valid round to prevent flashing if API returns partial data
  const lastValidRoundRef = useRef<number>(1);

  // Track cycleId to detect new game cycle (FINISHED → REGISTRATION transition)
  const lastCycleIdRef = useRef<string>("");

  // Time synchronization - now centralized in timeSynchronization.ts
  // Remove local state; use module exports instead

  // Determine polling interval based on game state
  // ENHANCEMENT: Keep minimal polling during post-game to detect cycleId transition
  const refreshInterval = isTransitioning 
    ? POLLING_INTERVALS.ROUND_TRANSITION 
    : gameFinished 
      ? POLLING_INTERVALS.POST_GAME_WAIT  // Keep polling to detect new cycle
      : POLLING_INTERVALS.ACTIVE_GAME;

  // Poll for active matches
  const {
    data: matchData,
    error,
    mutate,
  } = useSWR(`/api/match/active?fid=${fid}`, fetcherWithGameNotLive, {
    refreshInterval,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
    keepPreviousData: true,
    shouldRetryOnError: true, // Keep retrying even post-game to detect state change
    errorRetryCount: 3,
    errorRetryInterval: 1000,
  });

  // Track successful loads and errors, sync time offset on first poll only
  useEffect(() => {
    if (matchData && !error) {
      setHasLoadedOnce(true);
      setConsecutiveErrors(0);

      // Sync time offset ONLY on first successful load (prevents mid-game drift)
      // Uses centralized timing module - syncs once per session
      if (matchData.serverTime) {
        syncTimeOffset(matchData.serverTime);
      }

      // Update last valid round to prevent flashing
      if (matchData.currentRound) {
        lastValidRoundRef.current = matchData.currentRound;
      }
    } else if (error) {
      setConsecutiveErrors(prev => prev + 1);
    }
  }, [matchData, error]);

  // Detect new game cycle (cycleId changed) and reset UI state
  // This happens when FINISHED → REGISTRATION transition completes
  useEffect(() => {
    if (matchData?.cycleId && matchData.cycleId !== lastCycleIdRef.current) {
      if (lastCycleIdRef.current !== "") {
        // CycleId changed - new game cycle started, reset all state
        console.log(`[MultiChatContainer] New cycle detected: ${lastCycleIdRef.current} → ${matchData.cycleId}`);
        setGameFinished(false);
        setRoundResults([]);
        setVotes({});
        setBatchReveals([]);
        setLastRound(0);
        lastValidRoundRef.current = 1;
        // Reset time sync for new cycle
        resetTimeOffset();
      }
      lastCycleIdRef.current = matchData.cycleId;
    }
  }, [matchData?.cycleId]);

  // Check if game is finished (all rounds completed and no active matches)
  // Add safeguards to prevent premature game ending
  useEffect(() => {
    if (
      !gameFinished &&
      matchData?.matches &&
      matchData.matches.length === 0 &&
      matchData.currentRound > matchData.totalRounds &&
      // Safeguard: Only finish if we have completed all rounds worth of results
      roundResults.length === matchData.totalRounds &&
      // Extra safeguard: ensure at least one result
      roundResults.length > 0
    ) {
      console.log(`[MultiChatContainer] Game finished. Round ${matchData.currentRound}/${matchData.totalRounds}, Results: ${roundResults.length}`);
      setGameFinished(true);
    }
  }, [matchData?.currentRound, matchData?.totalRounds, matchData?.matches?.length, gameFinished, roundResults.length]);

  // Track round transitions for loading state
  useEffect(() => {
    if (matchData?.currentRound && matchData.currentRound !== lastRound) {
      // Round changed
      if (matchData.currentRound > lastRound) {
        setIsPreparingRound(false);
        // Reveal screen now handled via modal system (shown in reveal effect above)
      }

      if (lastRound > 0 && matchData.matches?.length === 0) {
        // We're between rounds - show transition
        setIsTransitioning(true);
        setTransitionTimeoutMessage("preparing");

        // Clear any existing timeouts
        if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
        if (transitionWarningRef.current) clearTimeout(transitionWarningRef.current);

        // Warn after 9 seconds (reveals: 6s + grace: 3s) if still transitioning
        transitionWarningRef.current = setTimeout(() => {
          console.warn(`[MultiChatContainer] Round transition taking longer than expected (>9s)`);
          setTransitionTimeoutMessage("delayed");
        }, 9000);

        // Force clear after 15 seconds max (safety net)
        transitionTimeoutRef.current = setTimeout(() => {
          console.warn(`[MultiChatContainer] Transition timeout after 15s, clearing isTransitioning`);
          setIsTransitioning(false);
          setTransitionTimeoutMessage(null);
        }, 15000);
      }
      setLastRound(matchData.currentRound);
    }

    // Clear transition when matches arrive
    if (matchData?.matches?.length > 0 && isTransitioning) {
      setIsTransitioning(false);
      setTransitionTimeoutMessage(null);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (transitionWarningRef.current) clearTimeout(transitionWarningRef.current);
    }
  }, [matchData?.currentRound, matchData?.matches?.length, lastRound, isTransitioning, batchReveals.length]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (transitionWarningRef.current) clearTimeout(transitionWarningRef.current);
    };
  }, []);

  // Initialize votes from match data and track new matches
  // Only depend on matches array length and IDs, not the whole matchData object
  useEffect(() => {
    if (matchData?.matches && Array.isArray(matchData.matches)) {
      const newVotes: VoteState = {};
      const newMatches = new Set<string>();

      matchData.matches.forEach((match: any) => {
        // Default to REAL (human) for new matches
        if (!votes[match.id]) {
          newVotes[match.id] = match.currentVote || "REAL";
          newMatches.add(match.id);
        }
      });

      if (Object.keys(newVotes).length > 0) {
        setVotes((prev) => ({ ...prev, ...newVotes }));
        setNewMatchIds(newMatches);

        // Clear new match status after animation period
        setTimeout(() => {
          setNewMatchIds(new Set());
        }, 5000);
      }
    }
  }, [matchData?.matches?.length, matchData?.matches?.map((m: any) => m.id).join(","), votes]);

  // Sync roundResults from server voteHistory
  // Only update if history length or content actually changes
  useEffect(() => {
    if (matchData?.voteHistory && Array.isArray(matchData.voteHistory)) {
      const history = matchData.voteHistory as any[];

      // Only update if count changed (efficient check before deep compare)
      if (history.length !== roundResults.length) {
        // Map voteHistory to RoundResult
        const newResults: RoundResult[] = history.map((h) => ({
          roundNumber: h.roundNumber || 1,
          correct: h.correct,
          opponentUsername: h.opponentUsername || "Unknown",
          opponentType: h.opponentType || "BOT",
          opponentFid: 0, // Not critical for summary
        }));

        setRoundResults(newResults);
      }
    }
  }, [matchData?.voteHistory?.length, matchData?.voteHistory?.map((v: any) => v.roundNumber).join(",")]);

  // Show reveal screen via modal when round ends
  useEffect(() => {
    if (
      batchReveals.length > 0 &&
      matchData?.matches?.length === 0
    ) {
      // Show reveal modal with 5s auto-close
      showModal('reveal', 
        {
          reveals: batchReveals,
          stats: {
            accuracy: roundResults.length > 0 ? (roundResults.filter((r) => r.correct).length / roundResults.length) * 100 : 0,
            correct: roundResults.filter((r) => r.correct).length,
            total: roundResults.length,
            playerRank: matchData?.playerRank,
            totalPlayers: matchData?.playerPool?.totalPlayers,
          },
          nextRoundNumber: matchData.currentRound,
        },
        { 
          autoClose: 5000,
          onClose: () => setBatchReveals([])
        }
      );
    }
  }, [batchReveals.length, matchData?.matches?.length, matchData?.currentRound, matchData?.playerRank, matchData?.playerPool?.totalPlayers, roundResults.length, showModal]);



  // Handle vote toggle
  const handleVoteToggle = useCallback(
    async (matchId: string) => {
      setVotes((prev): VoteState => {
        const currentVote = prev[matchId] || "REAL";
        const newVote = currentVote === "REAL" ? "BOT" : "REAL";

        // Optimistic update
        const updated: VoteState = { ...prev, [matchId]: newVote };

        // Fire and forget - send to server but don't wait
        fetch("/api/match/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, vote: newVote, fid }),
        }).catch((error) => {
          console.error("Error updating vote:", error);
        });

        return updated;
      });
    },
    [fid]
  );

  // Handle match completion - collect reveal data
  const handleMatchComplete = useCallback(
    async (matchId: string) => {
      // Don't process completions if we're already preparing the next round
      if (isPreparingRound) return;

      try {
        const response = await fetch("/api/match/vote", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, fid }),
        });

        const result = await response.json();

        if (response.ok && result.isCorrect !== undefined) {
          // Get the match to find opponent info
          const match = matchData?.matches.find((m: any) => m.id === matchId);
          if (match) {
            // Collect reveal data for batch display
            setBatchReveals((prev) => {
              // Prevent duplicates
              if (prev.some((r) => r.opponent.fid === match.opponent.fid)) return prev;
              return [
                ...prev,
                {
                  opponent: {
                    fid: match.opponent.fid,
                    username: match.opponent.username,
                    displayName: match.opponent.displayName,
                    pfpUrl: match.opponent.pfpUrl,
                  },
                  actualType: result.actualType,
                },
              ];
            });
          }
        }

        if (!response.ok) {
          console.error("Failed to lock vote:", result.error);
        }
      } catch (error) {
        console.error("Error locking vote:", error);
      }

      // Immediately refresh to get new matches
      await mutate();

      // Also refresh after a short delay to catch any async updates
      setTimeout(() => mutate(), 500);
    },
    [fid, mutate, matchData, isPreparingRound]
  );

  // Memoize bound handlers to prevent new function references on every render
  const boundHandlersRef = useRef<Map<string, { onVoteToggle: () => void; onComplete: () => void }>>(new Map());

  // Get or create stable handlers for a match ID
  const getStableHandlers = useCallback((matchId: string) => {
    if (!boundHandlersRef.current.has(matchId)) {
      boundHandlersRef.current.set(matchId, {
        onVoteToggle: () => handleVoteToggle(matchId),
        onComplete: () => handleMatchComplete(matchId),
      });
    }
    return boundHandlersRef.current.get(matchId)!;
  }, [handleVoteToggle, handleMatchComplete]);

  // Memoize slots to prevent ChatWindow from re-mounting on every matchData refresh
  // Use a ref to maintain stable references when match content hasn't changed
  const previousSlotsRef = useRef<any>({});

  // Safely access slots for useMemo dependencies
  const slots = matchData?.slots || {};

  const stableSlots = useMemo(() => {
    // If we're transitioning between rounds, keep showing the previous slots
    // This prevents flashing when matches disappear momentarily
    if (isTransitioning && Object.keys(previousSlotsRef.current).length > 0) {
      return previousSlotsRef.current;
    }

    if (!slots || Object.keys(slots).length === 0) {
      // Keep previous slots during transitions to prevent flicker
      return previousSlotsRef.current || {};
    }

    // Create a new slots object only if the match IDs or critical properties have changed
    const newSlots: any = {};
    let hasChanges = false;

    for (const slotNum of [1, 2]) {
      const currentMatch = slots[slotNum];
      const previousMatch = previousSlotsRef.current[slotNum];

      if (!currentMatch) {
        // Keep previous match during transitions instead of removing it
        // This prevents chat from disappearing when API briefly returns undefined
        if (previousMatch && !previousMatch.voteLocked) {
          // Only preserve if not locked (locked means completed)
          newSlots[slotNum] = previousMatch;
        }
        if (previousMatch && previousMatch.voteLocked) {
          hasChanges = true; // Mark for update if locked match is being removed
        }
        continue;
      }

      // Check if this is actually a different match or just a re-render
      const messageCountChanged = (previousMatch.messages?.length || 0) !== (currentMatch.messages?.length || 0);
      const messageContentChanged = messageCountChanged || 
        JSON.stringify(previousMatch.messages) !== JSON.stringify(currentMatch.messages);
      
      if (
        !previousMatch ||
        previousMatch.id !== currentMatch.id ||
        previousMatch.voteLocked !== currentMatch.voteLocked ||
        messageContentChanged
      ) {
        newSlots[slotNum] = currentMatch;
        hasChanges = true;
      } else {
        // Reuse the previous reference to prevent re-mounting
        newSlots[slotNum] = previousMatch;
      }
    }

    if (hasChanges || Object.keys(previousSlotsRef.current).length !== Object.keys(newSlots).length) {
      previousSlotsRef.current = newSlots;
      return newSlots;
    }

    return previousSlotsRef.current;
  }, [
    isTransitioning,
    slots[1]?.id,
    slots[2]?.id,
    slots[1]?.voteLocked,
    slots[2]?.voteLocked,
    slots[1]?.messages?.length,
    slots[2]?.messages?.length,
  ]);

  // Get matches for display
  const matches = matchData?.matches || [];

  // Check if game is not live (403 response)
  if (matchData?.gameNotLive) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Waiting for game to start...</p>
        <p className="text-sm text-gray-500 mt-2">Current state: {matchData.currentState}</p>
      </div>
    );
  }

  // Only show error state if we've never loaded successfully OR we've had multiple consecutive errors
  // This prevents UI flicker from transient errors
  if (error && (!hasLoadedOnce || consecutiveErrors >= 3)) {
    const msg = (error as any)?.message || "";
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
        <p className="text-red-400">Failed to load matches. Please refresh.</p>
        <p className="text-xs text-gray-500 mt-2">Error: {msg}</p>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-32 mx-auto mb-2"></div>
          <div className="h-3 bg-slate-700 rounded w-24 mx-auto"></div>
        </div>
      </div>
    );
  }

  const currentRound = matchData.currentRound || lastValidRoundRef.current || 1;
  const totalRounds = matchData.totalRounds || 5;

  if ((matchData as any).gameState && (matchData as any).gameState !== "LIVE") {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Waiting for game to start...</p>
        <p className="text-sm text-gray-500 mt-2">Registration ongoing</p>
      </div>
    );
  }

  // Show end game screen with leaderboard
  if (gameFinished && roundResults.length > 0) {
    const accuracy =
      (roundResults.filter((r) => r.correct).length / roundResults.length) *
      100;

    return (
      <Leaderboard
        fid={fid}
        isGameEnd={true}
        accuracy={accuracy}
        roundResults={roundResults}
        playerRank={matchData?.playerRank || 1}
        totalPlayers={matchData?.playerPool?.totalPlayers || 0}
        onPlayAgain={() => {
          setGameFinished(false);
          setRoundResults([]);
          setVotes({});
          mutate();
        }}
      />
    );
  }

  if (matches.length === 0 || isPreparingRound) {
    // Show loading state if transitioning between rounds
    const loaderMessage = transitionTimeoutMessage === "delayed"
      ? "Taking longer than expected... Stand by"
      : "Preparing next round...";

    return (
      <LoadingOverlay
        variant="round-start"
        message={loaderMessage}
        subtext={`Round ${Math.min(currentRound, totalRounds)} of ${totalRounds}`}
        inline={true}
        isVisible={true}
      />
    );
  }

  // Note: New message tracking would need WebSocket or more sophisticated tracking
  // for real new message detection - currently not implemented

  return (
    <div className="space-y-4">
      {/* Round indicator - more compact on mobile */}
      <div className="text-center mb-2 lg:mb-4">
        <span className="bg-slate-700 px-3 py-1 rounded-full text-xs lg:text-sm text-blue-300">
          Round {Math.min(currentRound, totalRounds)} of {totalRounds}
        </span>
        {/* Hide player pool info on mobile to save space */}
        {matchData.playerPool && (
          <p className="hidden lg:block text-xs text-gray-500 mt-2">
            {matchData.playerPool.totalPlayers} players •{" "}
            {matchData.playerPool.totalBots} bots in pool
          </p>
        )}
      </div>

      {/* Single responsive layout - grid on desktop, stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {[1, 2].map((slotNumber) => {
          const match = stableSlots[slotNumber];

          if (!match) {
            return (
              <div
                key={slotNumber}
                className="bg-slate-800/50 rounded-lg p-4 lg:p-6 border-2 border-dashed border-slate-700"
              >
                <div className="text-center text-gray-500">
                  <p className="text-sm lg:text-lg font-medium lg:mb-2">Chat Slot {slotNumber}</p>
                  <p className="text-xs lg:text-sm">Waiting for opponent...</p>
                </div>
              </div>
            );
          }

          const currentVote = votes[match.id] || "REAL";
          const voteColor =
            currentVote === "BOT" ? "border-red-500/50" : "border-green-500/50";

          // Get stable handlers to prevent ChatWindow remounting
          const stableHandlers = getStableHandlers(match.id);

          return (
            <div
              key={match.id}
              className={`relative border-l-4 ${voteColor} transition-colors duration-300 rounded-lg overflow-hidden`}
            >
              {/* Chat number badge - responsive sizing */}
              <div className="absolute top-2 right-2 lg:-top-2 lg:-right-2 z-10 bg-blue-600 lg:bg-blue-600 backdrop-blur-sm lg:backdrop-blur-none rounded-full w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center text-white font-bold text-xs lg:text-sm opacity-80 lg:opacity-100">
                {slotNumber}
              </div>

              {/* Chat content - single component with responsive props */}
              <ChatWindow
                fid={fid}
                match={match}
                currentVote={currentVote}
                onVoteToggle={stableHandlers.onVoteToggle}
                onComplete={stableHandlers.onComplete}
                variant="minimal"
                showVoteToggle={true}
                isNewMatch={newMatchIds.has(match.id)}
                onRefresh={async () => {
                  await mutate();
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Instructions - hidden on mobile to save space */}
      <div className="hidden lg:block bg-slate-900/50 rounded-xl p-4 mt-6 border border-slate-700/50 shadow-lg">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-center gap-2">
            <span className="text-lg">💡</span>
            Quick Tips
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300 leading-relaxed">
            <div>• 1 min rounds - decide fast!</div>
            <div>• Toggle vote anytime</div>
            <div>• Vote locks at timer end</div>
            <div>• Manage both chats</div>
            <div>• Use 🦄 or :unicorn:</div>
            <div>• 4 opponents total</div>
          </div>
        </div>
      </div>


    </div>
  );
}
