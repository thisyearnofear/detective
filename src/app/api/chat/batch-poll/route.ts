import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";
import { getScheduledBotResponse, markBotResponseDelivered, recordBotDeliveryFailure } from "@/lib/botScheduler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchIdsParam = searchParams.get("matchIds");

    if (!matchIdsParam) {
      return NextResponse.json({ error: "matchIds parameter is required." }, { status: 400 });
    }

    const matchIds = matchIdsParam.split(",").filter(id => id.trim());

    if (matchIds.length === 0) {
      return NextResponse.json({ error: "At least one valid match ID is required." }, { status: 400 });
    }

    const chatsByMatch: Record<string, any> = {};

    for (const matchId of matchIds) {
      const scheduledBot = await getScheduledBotResponse(matchId);
      if (scheduledBot) {
        const match = await gameManager.getMatch(matchId);
        if (match && match.endTime > Date.now()) {
          try {
            await gameManager.addMessageToMatch(matchId, scheduledBot.response, scheduledBot.botFid);
            await markBotResponseDelivered(matchId);
          } catch (error) {
            await recordBotDeliveryFailure(matchId, error instanceof Error ? error : new Error(String(error)));
            console.error(`[batch-poll] Failed to deliver bot response for match ${matchId}:`, error);
          }
        } else {
          await markBotResponseDelivered(matchId);
        }
      }

      const match = await gameManager.getMatch(matchId);

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
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
