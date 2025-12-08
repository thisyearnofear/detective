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

export default function GameFinishedView({ fid, onLogout }: Props) {
  // Fetch player stats
  const { data: statsData } = useSWR(
    fid ? `/api/stats/player/${fid}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch match data to get round results from voteHistory
  const { data: matchData } = useSWR(
    fid ? `/api/match/active?fid=${fid}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const playerStats = statsData?.stats || {
    total_games: 0,
    accuracy: 0,
    avg_speed_ms: 0,
  };

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
  const totalPlayers = matchData?.playerPool?.totalPlayers || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="hero-title text-3xl md:text-4xl font-black text-stroke mb-2">
          Game Over!
        </h2>
        <p className="text-gray-400 text-sm">
          Great job! See how you ranked against other players
        </p>
      </div>

      {/* Leaderboard */}
      <div className="space-y-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest px-4">Results</div>
        <Leaderboard
          fid={fid}
          isGameEnd={true}
          accuracy={accuracy}
          roundResults={roundResults}
          playerRank={playerRank}
          totalPlayers={totalPlayers}
          onPlayAgain={onLogout}
        />
      </div>

      {/* Next Steps */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Share Results */}
          <a
            href="https://warpcast.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-3 rounded-lg text-center text-sm font-semibold transition-all"
          >
            📊 Share Results
          </a>

          {/* View Stats */}
          <button
            onClick={() => {
              console.log('Navigate to stats');
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg text-center text-sm font-semibold transition-all"
          >
            📈 View Stats
          </button>
        </div>
      </div>

      {/* Next Game Prompt */}
      <div className="bg-gradient-to-br from-green-800/80 to-emerald-900/80 border-2 border-green-500/50 rounded-xl p-6 text-center backdrop-blur-sm">
        <p className="text-sm text-green-300 mb-4">Next game starting soon...</p>
        <button
          onClick={onLogout}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Join Next Game →
        </button>
      </div>

      {/* Your Stats Summary */}
      <div className="bg-slate-900/30 border border-white/5 rounded-lg p-4 space-y-3">
        <div className="text-xs text-gray-500 uppercase tracking-widest">Your Stats</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black text-blue-400">{playerStats.total_games}</p>
            <p className="text-xs text-gray-500">Total Games</p>
          </div>
          <div>
            <p className="text-2xl font-black text-yellow-400">{playerStats.accuracy.toFixed(0)}%</p>
            <p className="text-xs text-gray-500">Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-black text-green-400">{playerStats.avg_speed_ms}ms</p>
            <p className="text-xs text-gray-500">Avg Speed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
