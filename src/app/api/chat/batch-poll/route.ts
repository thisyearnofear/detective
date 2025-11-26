// src/app/api/chat/batch-poll/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";
import { getScheduledBotResponse, markBotResponseDelivered, recordBotDeliveryFailure } from "@/lib/botScheduler";
// import { getGameEventPublisher } from "@/lib/gameEventPublisher"; // TODO: Use when needed
import { getAblyServerManager } from "@/lib/ablyChannelManager";

/**
 * API route to poll messages for multiple matches at once.
 * This reduces the number of requests when handling simultaneous chats.
 *
 * Also delivers any scheduled bot responses that are ready.
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
    // const gameState = await gameManager.getGameState(); // TODO: Use when needed
    // const eventPublisher = getGameEventPublisher(); // TODO: Use when needed
    const ablyManager = getAblyServerManager();

    for (const matchId of matchIds) {
      // Check if a scheduled bot response is ready to deliver
      const scheduledBot = await getScheduledBotResponse(matchId);
      if (scheduledBot) {
        console.log(`[batch-poll] Found scheduled bot response for match ${matchId}, bot FID ${scheduledBot.botFid}`);
        const match = await gameManager.getMatch(matchId);
        if (match && match.endTime > Date.now()) {
          try {
            // Add the scheduled bot response to the match
            console.log(`[batch-poll] Attempting to deliver: "${scheduledBot.response.substring(0, 50)}${scheduledBot.response.length > 50 ? '...' : ''}"`);
            await gameManager.addMessageToMatch(matchId, scheduledBot.response, scheduledBot.botFid);
            await markBotResponseDelivered(matchId);
            
            // Publish to the match channel so connected clients get notified immediately
            const chatMessage = {
              id: `${Date.now()}-${scheduledBot.botFid}-${Math.random().toString(36).substr(2, 9)}`,
              text: scheduledBot.response,
              sender: {
                fid: scheduledBot.botFid,
                username: match.opponent.username,
              },
              timestamp: Date.now(),
            };
            await ablyManager.publishToMatchChannel(matchId, chatMessage);
            
            // NOTE: Removed duplicate publishChatMessage to prevent bot response duplication
            // The match channel publish above is sufficient for real-time delivery
            console.log(`[batch-poll] ✓ Published bot response via Ably for match ${matchId}`);
          } catch (error) {
            // Record failure for retry logic
            await recordBotDeliveryFailure(matchId, error instanceof Error ? error : new Error(String(error)));
            console.error(`[batch-poll] ✗ FAILED to deliver bot response for match ${matchId}:`, error);
          }
        } else {
          // Match ended or doesn't exist, clean up the scheduled response
          await markBotResponseDelivered(matchId);
          if (match) {
            console.log(`[batch-poll] Match ${matchId} ended, cleaned up scheduled response`);
          } else {
            console.log(`[batch-poll] Match ${matchId} not found, cleaned up scheduled response`);
          }
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
