import { NextRequest, NextResponse } from 'next/server';
import { getActiveCycle, addMessageToMatch } from '@/lib/gameState';
import { generateBotResponse } from '@/lib/inference';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { matchId, senderFid, senderUsername, content } = body as {
    matchId: string;
    senderFid: number;
    senderUsername: string;
    content: string;
  };

  const cycle = getActiveCycle();
  if (!cycle) return NextResponse.json({ error: 'No active game cycle' }, { status: 404 });

  const match = cycle.currentMatches.get(matchId);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  addMessageToMatch(match, senderFid, senderUsername, content, false);

  if (match.isPlayer2Bot && senderFid === match.player1Fid) {
    let personaUser = null as any;
    for (const u of cycle.registeredUsers.values()) {
      if (match.botPersonaUsername && u.username === match.botPersonaUsername) {
        personaUser = u;
        break;
      }
    }

    const botText = await generateBotResponse({
      username: match.botPersonaUsername || 'bot',
      displayName: personaUser?.displayName,
      recentCasts: personaUser?.recentCasts || [],
      userMessage: content,
      maxTokens: 150,
    });

    addMessageToMatch(match, 'BOT', match.botPersonaUsername || 'bot', botText, true);
  }

  return NextResponse.json({ messages: match.messages });
}

