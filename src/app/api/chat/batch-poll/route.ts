// src/app/api/chat/batch-poll/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";

/**
 * API route to poll messages for multiple matches at once.
 * This reduces the number of requests when handling simultaneous chats.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchIdsParam = searchParams.get("matchIds");

    if (!matchIdsParam) {
      return NextResponse.json(
        { error: "matchIds parameter is required." },
        { status: 400 }
      );
    }

    // Parse comma-separated match IDs
    const matchIds = matchIdsParam.split(",").filter(id => id.trim());

    if (matchIds.length === 0) {
      return NextResponse.json(
        { error: "At least one valid match ID is required." },
        { status: 400 }
      );
    }

    // Collect messages for all matches
    const chatsByMatch: Record<string, any> = {};

    for (const matchId of matchIds) {
      const match = gameManager.getMatch(matchId);

      if (match) {
        chatsByMatch[matchId] = {
          messages: match.messages,
          endTime: match.endTime,
          voteLocked: match.voteLocked,
          currentVote: match.currentVote,
          slotNumber: match.slotNumber,
          opponent: {
            fid: match.opponent.fid,
            username: match.opponent.username,
            displayName: match.opponent.displayName,
            pfpUrl: match.opponent.pfpUrl,
          },
        };
      } else {
        // Return empty data for non-existent matches
        chatsByMatch[matchId] = {
          messages: [],
          endTime: null,
          voteLocked: false,
          currentVote: null,
          slotNumber: null,
          opponent: null,
        };
      }
    }

    return NextResponse.json({
      chats: chatsByMatch,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error polling batch messages:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
