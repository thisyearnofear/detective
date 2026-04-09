"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import NegotiationInterface from "./game/NegotiationInterface";
import LoadingOverlay from "./LoadingOverlay";
import { fetcherWithGameNotLive, getApiUrl, requestJson } from "@/lib/fetcher";
import { isNegotiationMatch } from "@/lib/gameMode";
import type { NegotiationMatch, NegotiationAction, ResourcePool } from "@/lib/types";

type GameResults = {
  accuracy: number;
  roundResults: Array<{
    roundNumber: number;
    correct: boolean;
    opponentUsername: string;
    opponentType: "REAL" | "BOT";
  }>;
  playerRank: number;
  totalPlayers: number;
};

type Props = {
  fid: number;
  onGameFinishAction?: (results: GameResults) => void;
};

/**
 * MultiNegotiationContainer - Handles negotiation mode matches
 * 
 * MODULAR: Parallel to MultiChatContainer for conversation mode
 * CLEAN: Separate concerns for different game modes
 */
export default function MultiNegotiationContainer({ fid, onGameFinishAction }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [roundResults, setRoundResults] = useState<any[]>([]);

  // Poll for active matches
  const {
    data: matchData,
    error,
    mutate,
  } = useSWR(
    getApiUrl(`/api/match/active?fid=${fid}`),
    fetcherWithGameNotLive,
    {
      refreshInterval: 1000,
      dedupingInterval: 1000,
      refreshWhenHidden: true,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  // Check if game is finished
  useEffect(() => {
    if (
      !gameFinished &&
      matchData?.matches &&
      matchData.matches.length === 0 &&
      matchData.currentRound > matchData.totalRounds &&
      roundResults.length === matchData.totalRounds &&
      roundResults.length > 0
    ) {
      setGameFinished(true);

      if (onGameFinishAction && matchData.playerRank !== undefined && matchData.totalPlayers) {
        const accuracy = (roundResults.filter((r: any) => r.correct).length / roundResults.length) * 100;
        onGameFinishAction({
          accuracy,
          roundResults,
          playerRank: matchData.playerRank,
          totalPlayers: matchData.totalPlayers,
        });
      }
    }
  }, [
    matchData?.currentRound,
    matchData?.totalRounds,
    matchData?.matches?.length,
    matchData?.playerRank,
    matchData?.totalPlayers,
    gameFinished,
    roundResults.length,
    onGameFinishAction,
  ]);

  // Handle negotiation action
  const handleNegotiationAction = useCallback(
    async (
      matchId: string,
      action: NegotiationAction,
      message: string,
      proposal?: { myShare: ResourcePool; theirShare: ResourcePool }
    ) => {
      setIsProcessing(true);
      try {
        const response = await requestJson<any>("/api/negotiation/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, action, message, proposal }),
        });

        if (response.success) {
          // Refresh matches to get updated state
          await mutate();

          // If match finished, record result
          if (response.outcome) {
            setRoundResults((prev) => [
              ...prev,
              {
                roundNumber: response.match.roundNumber,
                correct: response.outcome.playerScore > 0, // Positive score = success
                opponentUsername: response.match.opponent.username,
                opponentType: response.match.opponent.type,
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Error handling negotiation action:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [mutate]
  );

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
        <p className="text-red-400">Failed to load matches. Please refresh.</p>
      </div>
    );
  }

  // Loading state
  if (!matchData) {
    return (
      <LoadingOverlay
        variant="round-start"
        message="Loading negotiation..."
        inline={true}
        isVisible={true}
      />
    );
  }

  // Game not live
  if (matchData?.gameNotLive) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Waiting for game to start...</p>
      </div>
    );
  }

  const matches = matchData?.matches || [];
  const currentRound = matchData.currentRound || 1;
  const totalRounds = matchData.totalRounds || 5;

  // No matches - waiting for next round
  if (matches.length === 0) {
    return (
      <LoadingOverlay
        variant="round-start"
        message="Preparing next negotiation..."
        subtext={`Round ${Math.min(currentRound, totalRounds)} of ${totalRounds}`}
        inline={true}
        isVisible={true}
      />
    );
  }

  // Game finished
  if (gameFinished && roundResults.length > 0) {
    const accuracy = (roundResults.filter((r: any) => r.correct).length / roundResults.length) * 100;
    
    return (
      <div className="space-y-6 text-center py-8">
        <div className="text-6xl mb-4">🤝</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Negotiation Complete!</h2>
          <p className="text-gray-400">
            You scored {accuracy.toFixed(1)}% across {roundResults.length} rounds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Round indicator */}
      <div className="text-center">
        <span className="bg-purple-900/50 border border-purple-500/50 px-4 py-2 rounded-full text-sm text-purple-300">
          🤝 Negotiation Round {Math.min(currentRound, totalRounds)} of {totalRounds}
        </span>
        {matchData?.totalPlayers && (
          <p className="text-xs text-gray-500 mt-2">
            {matchData.totalPlayers} players negotiating
          </p>
        )}
      </div>

      {/* Negotiation matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matches.map((match: any) => {
          // Verify it's a negotiation match
          if (!isNegotiationMatch(match)) {
            return (
              <div key={match.id} className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 text-sm">Invalid match type</p>
              </div>
            );
          }

          return (
            <div
              key={match.id}
              className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-2 border-purple-500/30 rounded-xl p-4"
            >
              {/* Opponent info */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                {match.opponent.pfpUrl && (
                  <img
                    src={match.opponent.pfpUrl}
                    alt={match.opponent.username}
                    className="w-10 h-10 rounded-full border-2 border-purple-500/50"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    @{match.opponent.username}
                  </p>
                  <p className="text-xs text-gray-400">
                    {match.opponent.type === "BOT" ? "🤖 AI Opponent" : "👤 Human"}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  Slot {match.slotNumber}
                </div>
              </div>

              {/* Negotiation interface */}
              <NegotiationInterface
                match={match as NegotiationMatch}
                onAction={async (action, message, proposal) => {
                  await handleNegotiationAction(match.id, action, message, proposal);
                }}
                isProcessing={isProcessing}
              />
            </div>
          );
        })}
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-4 border border-purple-500/30">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center justify-center gap-2">
            <span className="text-lg">💡</span>
            Negotiation Tips
          </h3>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <div className="bg-white/5 rounded-full px-3 py-1">
              📊 Higher value items = more points
            </div>
            <div className="bg-white/5 rounded-full px-3 py-1">
              🤝 Deal = score, No deal = -50%
            </div>
            <div className="bg-white/5 rounded-full px-3 py-1">
              ⏱️ 5 rounds to reach agreement
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
