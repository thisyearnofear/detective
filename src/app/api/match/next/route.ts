import { NextRequest, NextResponse } from 'next/server';
import { getActiveCycle, createMatch } from '@/lib/gameState';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fidParam = searchParams.get('fid');
  const fid = fidParam ? parseInt(fidParam, 10) : NaN;
  if (!fid || Number.isNaN(fid)) return NextResponse.json({ error: 'Missing fid' }, { status: 400 });

  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ error: 'No active cycle' }, { status: 404 });

  for (const m of cycle.currentMatches.values()) {
    if (m.player1Fid === fid) return NextResponse.json({ match: m });
  }

  const available: number[] = [];
  for (const k of cycle.registeredUsers.keys()) {
    if (k !== fid && !cycle.matchedPlayers.has(k)) available.push(k);
  }

  let match;
  const useBot = available.length === 0 || Math.random() < 0.5;
  if (useBot) {
    const personaPool = Array.from(cycle.registeredUsers.values()).filter((u) => u.fid !== fid);
    const persona = personaPool[Math.floor(Math.random() * Math.max(personaPool.length, 1))];
    match = createMatch(cycle, fid, 'BOT', persona?.username);
    cycle.matchedPlayers.add(fid);
  } else {
    const opponentFid = available[Math.floor(Math.random() * available.length)];
    match = createMatch(cycle, fid, opponentFid);
    cycle.matchedPlayers.add(fid);
    cycle.matchedPlayers.add(opponentFid);
  }

  cycle.currentMatches.set(match.id, match);
  return NextResponse.json({ match });
}

