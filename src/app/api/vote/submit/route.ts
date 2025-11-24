import { NextRequest, NextResponse } from 'next/server';
import { getActiveCycle, submitVote, calculateLeaderboard } from '@/lib/gameState';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { matchId, voterFid, guess } = body as {
    matchId: string;
    voterFid: number;
    guess: 'REAL' | 'BOT';
  };

  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ error: 'No active game cycle' }, { status: 404 });

  const match = cycle.currentMatches.get(matchId);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  submitVote(match, voterFid, guess);
  const shouldFinalize = match.isPlayer2Bot
    ? true
    : (() => {
        const player2 = typeof match.player2FidOrBot === 'number' ? match.player2FidOrBot : null;
        return player2 !== null && match.votes.has(match.player1Fid) && match.votes.has(player2);
      })();

  if (shouldFinalize) {
    match.endedAt = new Date();
    cycle.currentMatches.delete(matchId);
    cycle.completedMatches.push(match);
  }

  const leaderboard = calculateLeaderboard(cycle);
  return NextResponse.json({ ok: true, leaderboard, finalized: shouldFinalize });
}
