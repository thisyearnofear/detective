"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import ChatWindow from "./ChatWindow";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Props = {
  fid: number;
};

type VoteState = Record<string, "REAL" | "BOT">;

export default function MultiChatContainer({ fid }: Props) {
  const [activeTab, setActiveTab] = useState(1);
  const [votes, setVotes] = useState<VoteState>({});

  // Poll for active matches
  const {
    data: matchData,
    error,
    mutate,
  } = useSWR(`/api/match/active?fid=${fid}`, fetcher, {
    refreshInterval: 1000, // Faster polling for better responsiveness
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  });

  // Initialize votes from match data
  useEffect(() => {
    if (matchData?.matches) {
      const newVotes: VoteState = {};
      matchData.matches.forEach((match: any) => {
        if (match.currentVote && !votes[match.id]) {
          newVotes[match.id] = match.currentVote;
        }
      });
      if (Object.keys(newVotes).length > 0) {
        setVotes((prev) => ({ ...prev, ...newVotes }));
      }
    }
  }, [matchData]);

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
    [votes, fid],
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

        if (!response.ok) {
          console.error("Failed to lock vote:", await response.text());
        }
      } catch (error) {
        console.error("Error locking vote:", error);
      }

      // Immediately refresh to get new matches
      await mutate();

      // Also refresh after a short delay to catch any async updates
      setTimeout(() => mutate(), 500);
    },
    [fid, mutate],
  );

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
        <p className="text-red-400">Failed to load matches. Please refresh.</p>
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
  } = matchData;

  if (matches.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Waiting for matches to start...</p>
        <p className="text-sm text-gray-500 mt-2">
          Round {currentRound} of {totalRounds} beginning soon
        </p>
      </div>
    );
  }

  // Check if any match has new messages (for notification badges)
  const hasNewMessages: Record<number, boolean> = {};
  // This would need WebSocket or more sophisticated tracking for real new message detection

  return (
    <div className="space-y-4">
      {/* Round indicator */}
      <div className="text-center mb-4">
        <span className="bg-slate-700 px-3 py-1 rounded-full text-sm text-blue-300">
          Round {currentRound} of {totalRounds}
        </span>
        {matchData.playerPool && (
          <p className="text-xs text-gray-500 mt-2">
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

          return (
            <div key={match.id} className="relative">
              {/* Chat number badge */}
              <div className="absolute -top-2 -right-2 z-10 bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-sm">
                {slotNumber}
              </div>

              {/* Vote indicator */}
              <div
                className={`absolute top-2 left-2 z-10 px-2 py-1 rounded text-xs font-bold ${
                  votes[match.id] === "BOT"
                    ? "bg-red-500/20 text-red-300 border border-red-500/50"
                    : votes[match.id] === "REAL"
                      ? "bg-green-500/20 text-green-300 border border-green-500/50"
                      : "bg-gray-500/20 text-gray-300 border border-gray-500/50"
                }`}
              >
                {votes[match.id] === "BOT"
                  ? "🤖 Bot"
                  : votes[match.id] === "REAL"
                    ? "👤 Human"
                    : "❓ Undecided"}
              </div>

              <ChatWindow
                fid={fid}
                match={match}
                currentVote={votes[match.id]}
                onVoteToggle={() => handleVoteToggle(match.id)}
                onComplete={() => handleMatchComplete(match.id)}
                isCompact={true}
                showVoteToggle={true}
              />
            </div>
          );
        })}
      </div>

      {/* Mobile view - tabbed interface */}
      <div className="lg:hidden">
        {/* Tab buttons */}
        <div className="flex justify-center gap-2 mb-4">
          {[1, 2].map((slotNumber) => {
            const match = slots[slotNumber];
            const isActive = activeTab === slotNumber;

            return (
              <button
                key={slotNumber}
                onClick={() => setActiveTab(slotNumber)}
                disabled={!match}
                className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : match
                      ? "bg-slate-700 text-gray-300 hover:bg-slate-600"
                      : "bg-slate-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                Chat {slotNumber}
                {hasNewMessages[slotNumber] && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active chat */}
        {slots[activeTab] ? (
          <div className="relative">
            {/* Vote indicator */}
            <div
              className={`absolute top-2 left-2 z-10 px-2 py-1 rounded text-xs font-bold ${
                votes[slots[activeTab].id] === "BOT"
                  ? "bg-red-500/20 text-red-300 border border-red-500/50"
                  : votes[slots[activeTab].id] === "REAL"
                    ? "bg-green-500/20 text-green-300 border border-green-500/50"
                    : "bg-gray-500/20 text-gray-300 border border-gray-500/50"
              }`}
            >
              {votes[slots[activeTab].id] === "BOT"
                ? "🤖 Bot"
                : votes[slots[activeTab].id] === "REAL"
                  ? "👤 Human"
                  : "❓ Undecided"}
            </div>

            <ChatWindow
              fid={fid}
              match={slots[activeTab]}
              currentVote={votes[slots[activeTab].id]}
              onVoteToggle={() => handleVoteToggle(slots[activeTab].id)}
              onComplete={() => handleMatchComplete(slots[activeTab].id)}
              isCompact={false}
              showVoteToggle={true}
            />
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-6 border-2 border-dashed border-slate-700">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Chat Slot {activeTab}</p>
              <p className="text-sm">Waiting for opponent...</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-slate-900/50 rounded-lg p-4 mt-6">
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
    </div>
  );
}
