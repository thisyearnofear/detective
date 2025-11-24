import { NextResponse } from 'next/server';
import { getActiveCycle } from '@/lib/gameState';

export async function GET() {
  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ cycles: [] });

  const now = new Date();
  let status: 'REGISTRATION' | 'LIVE' | 'FINISHED' = 'REGISTRATION';
  if (now >= cycle.startTime && now <= cycle.endTime) status = 'LIVE';
  else if (now > cycle.endTime) status = 'FINISHED';

  return NextResponse.json({
    cycles: [
      {
        id: cycle.id,
        name: cycle.name,
        registrationOpenAt: cycle.registrationOpenAt,
        registrationCloseAt: cycle.registrationCloseAt,
        startTime: cycle.startTime,
        endTime: cycle.endTime,
        status,
        players: cycle.registeredUsers.size,
        maxPlayers: cycle.maxPlayers,
      },
    ],
  });
}

