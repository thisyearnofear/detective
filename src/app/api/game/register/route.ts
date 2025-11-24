import { NextRequest, NextResponse } from 'next/server';
import { createGameCycle, getActiveCycle, setActiveCycle, registerUserForGame } from '@/lib/gameState';
import { fetchUserByFid, getUserRecentCasts, verifyNeynarScore } from '@/lib/neynar';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fid } = body as { fid: number };

  const scoreOk = await verifyNeynarScore(fid, 0.8);
  if (!scoreOk) return NextResponse.json({ error: 'Neynar score below 0.8' }, { status: 403 });

  let cycle = getActiveCycle();
  if (!cycle) {
    const now = new Date();
    cycle = createGameCycle('Cycle', new Date(now.getTime() - 60 * 60 * 1000), new Date(now.getTime() + 24 * 60 * 60 * 1000), now, new Date(now.getTime() + 48 * 60 * 60 * 1000));
    setActiveCycle(cycle);
  }

  const userInfo = await fetchUserByFid(fid);
  if (!userInfo) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const casts = await getUserRecentCasts(fid, 30);

  const user = {
    fid: userInfo.fid,
    username: userInfo.username,
    displayName: userInfo.displayName,
    pfpUrl: userInfo.pfpUrl,
    recentCasts: casts,
    neynarScore: userInfo.neynarScore,
    createdAt: new Date(),
  };

  const res = registerUserForGame(cycle, user);
  if (!res.success) return NextResponse.json({ error: res.message }, { status: 400 });

  return NextResponse.json({ success: true });
}

