"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import useSWR from "swr";
import ChatWindow from "./ChatWindow";
import ResultsCard from "./ResultsCard";
import RoundStartLoader from "./RoundStartLoader";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json();
};

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
  const [votes, setVotes] = useState<VoteState>({});
  const [newMatchIds, setNewMatchIds] = useState<Set<string>>(new Set());
  const [gameFinished, setGameFinished] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [revealingMatch, setRevealingMatch] = useState<string | null>(null);
  const [revealQueue, setRevealQueue] = useState<Array<{
    matchId: string;
    data: {
      opponent: {
        fid: number;
        username: string;
        displayName: string;
        pfpUrl: string;
      };
      actualType: "REAL" | "BOT";
    };
  }>>([]);
  const [revealData, setRevealData] = useState<{
    opponent: {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl: string;
      actualType?: "REAL" | "BOT"; // Add this to fix type error if needed, but the structure below matches
    };
    actualType: "REAL" | "BOT";
  } | null>(null);
  // Track if we've ever successfully loaded matches (to prevent premature error display)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  // Track round transitions for loading state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastRound, setLastRound] = useState(0);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for active matches
  const {
    data: matchData,
    error,
    mutate,
  } = useSWR(`/api/match/active?fid=${fid}`, fetcher, {
    refreshInterval: 1000, // Faster polling for better responsiveness
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    // Keep previous data on error to prevent UI flicker
    keepPreviousData: true,
    // Don't throw on error, let us handle it gracefully
    shouldRetryOnError: true,
    errorRetryCount: 3,
    errorRetryInterval: 1000,
  });

  // Track successful loads and errors
  useEffect(() => {
    if (matchData && !error) {
      setHasLoadedOnce(true);
      setConsecutiveErrors(0);
    } else if (error) {
      setConsecutiveErrors(prev => prev + 1);
    }
  }, [matchData, error]);

  // Check if game is finished (all rounds completed and no active matches)
  // Add safeguards to prevent premature game ending
  useEffect(() => {
    if (
      !gameFinished &&
      matchData?.matches &&
      matchData.matches.length === 0 &&
      matchData.currentRound > matchData.totalRounds &&
      // Safeguard: Only finish if we have some round results
      roundResults.length > 0 &&
      // Safeguard: Ensure we've played at least one round worth of matches
      roundResults.length >= 2
    ) {
      console.log(`[MultiChatContainer] Game finished. Round ${matchData.currentRound}/${matchData.totalRounds}, Results: ${roundResults.length}`);
      setGameFinished(true);
    }
  }, [matchData, gameFinished, roundResults.length]);

  // Track round transitions for loading state
  useEffect(() => {
    if (matchData?.currentRound && matchData.currentRound !== lastRound) {
      // Round changed
      if (lastRound > 0 && matchData.matches?.length === 0) {
        // We're between rounds - show transition
        setIsTransitioning(true);

        // Clear any existing timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }

        // Auto-clear transition after 10 seconds max
        transitionTimeoutRef.current = setTimeout(() => {
          setIsTransitioning(false);
        }, 10000);
      }
      setLastRound(matchData.currentRound);
    }

    // Clear transition when matches arrive
    if (matchData?.matches?.length > 0 && isTransitioning) {
      setIsTransitioning(false);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    }
  }, [matchData?.currentRound, matchData?.matches?.length, lastRound, isTransitioning]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Initialize votes from match data and track new matches
  useEffect(() => {
    if (matchData?.matches) {
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
  }, [matchData]);

  // Sync roundResults from server voteHistory
  useEffect(() => {
    if (matchData?.voteHistory) {
      const history = matchData.voteHistory as any[];
      // Map voteHistory to RoundResult
      const newResults: RoundResult[] = history.map((h) => ({
        roundNumber: h.roundNumber || 1,
        correct: h.correct,
        opponentUsername: h.opponentUsername || "Unknown",
        opponentType: h.opponentType || "BOT",
        opponentFid: 0, // Not critical for summary
      }));

      // Simple deep compare to avoid infinite loops
      if (JSON.stringify(newResults) !== JSON.stringify(roundResults)) {
        setRoundResults(newResults);
      }
    }
  }, [matchData?.voteHistory, roundResults]);

  // Process reveal queue
  useEffect(() => {
    if (!revealingMatch && revealQueue.length > 0) {
      const nextReveal = revealQueue[0];
      setRevealQueue((prev) => prev.slice(1));
      setRevealingMatch(nextReveal.matchId);
      setRevealData(nextReveal.data);

      setTimeout(() => {
        setRevealingMatch(null);
        setRevealData(null);
      }, 2000);
    }
  }, [revealingMatch, revealQueue]);

  // Handle vote toggle
  const handleVoteToggle = useCallback(
    async (matchId: string) => {
      const currentVote = votes[matchId] || "REAL";
      const newVote = currentVote === "REAL" ? "BOT" : "REAL";

      // Optimistic update
      setVotes((prev) => ({ ...prev, [matchId]: newVote }));

      try {
        const response = await fetch("/api/match/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, vote: newVote, fid }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Revert on error
          setVotes((prev) => ({ ...prev, [matchId]: currentVote }));
          console.error("Failed to update vote:", result.error);
        }
      } catch (error) {
        // Revert on error
        setVotes((prev) => ({ ...prev, [matchId]: currentVote }));
        console.error("Error updating vote:", error);
      }
    },
    [votes, fid]
  );

  // Handle match completion
  const handleMatchComplete = useCallback(
    async (matchId: string) => {
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
            // Add to reveal queue
            setRevealQueue((prev) => [
              ...prev,
              {
                matchId,
                data: {
                  opponent: {
                    fid: match.opponent.fid,
                    username: match.opponent.username,
                    displayName: match.opponent.displayName,
                    pfpUrl: match.opponent.pfpUrl,
                  },
                  actualType: result.actualType,
                },
              },
            ]);
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
    [fid, mutate, matchData]
  );

  // Only show error state if we've never loaded successfully OR we've had multiple consecutive errors
  // This prevents UI flicker from transient errors
  if (error && (!hasLoadedOnce || consecutiveErrors >= 3)) {
    const msg = (error as any)?.message || "";
    const isNotLive = msg.includes("403");
    return isNotLive ? (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Waiting for game to start...</p>
        <p className="text-sm text-gray-500 mt-2">Registration ongoing</p>
      </div>
    ) : (
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

  const {
    matches = [],
    slots = {},
    currentRound = 1,
    totalRounds = 5,
    cycleId = "",
  } = matchData;

  // Calculate player count and active match IDs for shared channel optimization
  const playerCount = matchData?.playerPool?.totalPlayers || 0;
  const activeMatchIds = matches.map((m: any) => m.id);

  if ((matchData as any).gameState && (matchData as any).gameState !== "LIVE") {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Waiting for game to start...</p>
        <p className="text-sm text-gray-500 mt-2">Registration ongoing</p>
      </div>
    );
  }

  // Show end game screen
  if (gameFinished && roundResults.length > 0) {
    const accuracy =
      (roundResults.filter((r) => r.correct).length / roundResults.length) *
      100;

    return (
      <ResultsCard
        isVisible={true}
        mode="game-complete"
        accuracy={accuracy}
        roundResults={roundResults}
        leaderboardRank={matchData?.playerRank || 1}
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

  if (matches.length === 0) {
    return (
      <RoundStartLoader
        roundNumber={currentRound}
        totalRounds={totalRounds}
        message={isTransitioning ? "Preparing next round..." : "Finding opponents..."}
        inline={true}
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
          Round {currentRound} of {totalRounds}
        </span>
        {/* Hide player pool info on mobile to save space */}
        {matchData.playerPool && (
          <p className="hidden lg:block text-xs text-gray-500 mt-2">
            {matchData.playerPool.totalPlayers} players •{" "}
            {matchData.playerPool.totalBots} bots in pool
          </p>
        )}
      </div>

      {/* Desktop view - show both chats side by side */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4">
        {[1, 2].map((slotNumber) => {
          const match = slots[slotNumber];

          if (!match) {
            return (
              <div
                key={slotNumber}
                className="bg-slate-800/50 rounded-lg p-6 border-2 border-dashed border-slate-700"
              >
                <div className="text-center text-gray-500">
                  <p className="text-lg mb-2">Chat Slot {slotNumber}</p>
                  <p className="text-sm">Waiting for opponent...</p>
                </div>
              </div>
            );
          }

          const currentVote = votes[match.id] || "REAL";
          const voteColor =
            currentVote === "BOT" ? "border-red-500/50" : "border-green-500/50";

          return (
            <div
              key={match.id}
              className={`relative border-l-4 ${voteColor} transition-colors duration-300 rounded-lg overflow-hidden`}
            >
              {/* Chat number badge */}
              <div className="absolute -top-2 -right-2 z-10 bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-sm">
                {slotNumber}
              </div>

              {/* Chat content */}
              <ChatWindow
                fid={fid}
                match={match}
                currentVote={currentVote}
                onVoteToggle={() => handleVoteToggle(match.id)}
                onComplete={() => handleMatchComplete(match.id)}
                isCompact={true}
                showVoteToggle={true}
                isNewMatch={newMatchIds.has(match.id)}
                cycleId={cycleId}
                playerCount={playerCount}
                activeMatchIds={activeMatchIds}
              />
            </div>
          );
        })}
      </div>

      {/* Mobile view - stacked chats for simultaneous viewing */}
      <div className="lg:hidden space-y-3">
        {[1, 2].map((slotNumber) => {
          const match = slots[slotNumber];

          if (!match) {
            return (
              <div
                key={slotNumber}
                className="bg-slate-800/50 rounded-lg p-4 border-2 border-dashed border-slate-700"
              >
                <div className="text-center text-gray-500">
                  <p className="text-sm font-medium">Chat {slotNumber}</p>
                  <p className="text-xs">Waiting for opponent...</p>
                </div>
              </div>
            );
          }

          const currentVote = votes[match.id] || "REAL";
          const voteColor =
            currentVote === "BOT" ? "border-red-500/50" : "border-green-500/50";

          return (
            <div
              key={match.id}
              className={`relative border-l-4 ${voteColor} transition-colors duration-300 rounded-lg overflow-hidden`}
            >
              {/* Chat number badge */}
              <div className="absolute top-2 right-2 z-10 bg-blue-600/80 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">
                {slotNumber}
              </div>

              {/* Chat content - mobile compact mode */}
              <ChatWindow
                fid={fid}
                match={match}
                currentVote={currentVote}
                onVoteToggle={() => handleVoteToggle(match.id)}
                onComplete={() => handleMatchComplete(match.id)}
                isCompact={true}
                isMobileStacked={true}
                showVoteToggle={true}
                isNewMatch={newMatchIds.has(match.id)}
                cycleId={cycleId}
                playerCount={playerCount}
                activeMatchIds={activeMatchIds}
              />
            </div>
          );
        })}
      </div>

      {/* Instructions - hidden on mobile to save space */}
      <div className="hidden lg:block bg-slate-900/50 rounded-lg p-4 mt-6">
        <h3 className="text-sm font-bold text-gray-300 mb-2">Quick Tips:</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Each chat lasts 1 minute - make your decision quickly!</li>
          <li>• Toggle your vote anytime during the chat</li>
          <li>• Your vote locks when the timer ends</li>
          <li>• Manage both conversations to maximize your score</li>
          <li>
            • Use the 🦄 button for quick emoji access (or type :unicorn:)
          </li>
          <li>
            • You'll face {matchData?.playerPool?.totalOpponents || "multiple"}{" "}
            different opponents
          </li>
        </ul>
      </div>

      {/* Opponent reveal card */}
      {revealData && revealingMatch && (
        <ResultsCard
          isVisible={revealingMatch !== null}
          mode="opponent-reveal"
          opponent={revealData.opponent}
          actualType={revealData.actualType}
        />
      )}
    </div>
  );
}
