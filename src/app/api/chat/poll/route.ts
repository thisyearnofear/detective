import { NextRequest, NextResponse } from 'next/server';
import { getActiveCycle } from '@/lib/gameState';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get('matchId');
  const since = searchParams.get('since');
  if (!matchId) return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });

  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ messages: [] });
  const match = cycle.currentMatches.get(matchId);
  if (!match) return NextResponse.json({ messages: [] });

  let messages = match.messages;
  if (since) {
    const s = new Date(since);
    messages = messages.filter((m) => new Date(m.timestamp) > s);
  }

  return NextResponse.json({ messages });
}
