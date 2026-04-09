"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import MultiChatContainer from "../MultiChatContainer";
import MultiNegotiationContainer from "../MultiNegotiationContainer";
import { fetcher, getApiUrl } from "@/lib/fetcher";

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
  cycleId: string;
  onGameFinishAction?: (results: GameResults) => void;
};

/**
 * GameActiveView - Displays during LIVE game state
 *
 * Detects game mode and renders appropriate interface:
 * - Conversation mode: MultiChatContainer
 * - Negotiation mode: MultiNegotiationContainer
 */
export default function GameActiveView({
  fid,
  cycleId,
  onGameFinishAction,
}: Props) {
  const [gameMode, setGameMode] = useState<string>("conversation");

  // Fetch game config to determine mode
  const { data: gameState } = useSWR(
    getApiUrl("/api/game/status"),
    fetcher,
    {
      refreshInterval: 5000, // Check mode every 5s
      revalidateOnFocus: true,
    }
  );

  useEffect(() => {
    if (gameState?.mode) {
      setGameMode(gameState.mode);
    }
  }, [gameState?.mode]);

  // Render mode-specific container
  if (gameMode === "negotiation") {
    return (
      <MultiNegotiationContainer
        key={cycleId || "live-game"}
        fid={fid}
        onGameFinishAction={onGameFinishAction}
      />
    );
  }

  // Default: conversation mode
  return (
    <MultiChatContainer
      key={cycleId || "live-game"}
      fid={fid}
      onGameFinishAction={onGameFinishAction}
    />
  );
}
