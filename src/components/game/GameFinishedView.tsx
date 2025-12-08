'use client';

import useSWR from 'swr';
import Leaderboard from '../Leaderboard';
import { fetcher } from '@/lib/fetcher';

type Props = {
  fid?: number;
  gameState: {
    cycleId: string;
    state: string;
    playerCount: number;
    registrationEnds: number;
    gameEnds: number;
    isRegistered: boolean;
  };
  onLogout: () => void;
};

type RoundResult = {
  roundNumber: number;
  correct: boolean;
  opponentUsername: string;
  opponentType: "REAL" | "BOT";
  opponentFid: number;
};

export default function GameFinishedView({ fid, gameState, onLogout }: Props) {
  // Fetch match data to get round results from voteHistory
  const { data: matchData } = useSWR(
    fid ? `/api/match/active?fid=${fid}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Extract round results from voteHistory
  const roundResults: RoundResult[] = matchData?.voteHistory
    ? matchData.voteHistory.map((h: any) => ({
        roundNumber: h.roundNumber || 1,
        correct: h.correct,
        opponentUsername: h.opponentUsername || "Unknown",
        opponentType: h.opponentType || "BOT",
        opponentFid: 0,
      }))
    : [];

  const accuracy = roundResults.length > 0
    ? (roundResults.filter((r) => r.correct).length / roundResults.length) * 100
    : 0;

  const playerRank = matchData?.playerRank || 1;
  const totalPlayers = gameState?.playerCount || 0;

  return (
    <Leaderboard
      fid={fid}
      isGameEnd={true}
      accuracy={accuracy}
      roundResults={roundResults}
      playerRank={playerRank}
      totalPlayers={totalPlayers}
      onPlayAgain={onLogout}
    />
  );
}
