"use client";

import MultiChatContainer from "../MultiChatContainer";

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
 */
export default function GameActiveView({
  fid,
  cycleId,
  onGameFinishAction,
}: Props) {
  return (
    <MultiChatContainer
      key={cycleId || "live-game"}
      fid={fid}
      onGameFinishAction={onGameFinishAction}
    />
  );
}
