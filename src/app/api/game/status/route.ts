import { NextResponse } from 'next/server';
import { getActiveCycle } from '@/lib/gameState';

export async function GET() {
  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ active: false });
  return NextResponse.json({
    active: true,
    cycleId: cycle.id,
    name: cycle.name,
    players: cycle.registeredUsers.size,
    maxPlayers: cycle.maxPlayers,
    matches: cycle.currentMatches.size,
  });
}

