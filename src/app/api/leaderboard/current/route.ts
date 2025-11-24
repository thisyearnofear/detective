import { NextResponse } from 'next/server';
import { getActiveCycle, calculateLeaderboard } from '@/lib/gameState';

export async function GET() {
  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ entries: [] });
  const leaderboard = calculateLeaderboard(cycle);
  return NextResponse.json({ entries: leaderboard });
}

