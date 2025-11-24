import { NextRequest, NextResponse } from 'next/server';
import { getActiveCycle } from '@/lib/gameState';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get('matchId') || '';
  const since = searchParams.get('since');

  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ error: 'No active game cycle' }, { status: 404 });

  const match = cycle.currentMatches.get(matchId);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  let messages = match.messages;
  if (since) {
    const t = new Date(since).getTime();
    messages = messages.filter((m) => new Date(m.timestamp).getTime() > t);
  }

  return NextResponse.json({ messages });
}

