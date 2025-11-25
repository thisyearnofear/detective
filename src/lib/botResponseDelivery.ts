/**
 * Bot Response Delivery - Background service
 * 
 * Checks for ready bot responses and publishes them immediately via Ably
 * without waiting for client polling. This reduces latency significantly.
 */

import { gameManager } from "./gameState";
import { getScheduledBotResponse, markBotResponseDelivered, recordBotDeliveryFailure } from "./botScheduler";
import { getAblyServerManager } from "./ablyChannelManager";
import { getGameEventPublisher } from "./gameEventPublisher";
import { redis } from "./redis";

let isRunning = false;
let checkInterval: NodeJS.Timeout | null = null;

/**
 * Check all scheduled bot responses and deliver those that are ready
 */
async function checkAndDeliverReadyResponses() {
  try {
    // Get all scheduled bot responses
    const keys = await redis.keys("bot:scheduled:*");
    
    if (keys.length === 0) return;

    const gameState = await gameManager.getGameState();
    const ablyManager = getAblyServerManager();
    const eventPublisher = getGameEventPublisher();

    for (const key of keys) {
      const matchId = key.replace("bot:scheduled:", "");
      const scheduledBot = await getScheduledBotResponse(matchId);

      if (scheduledBot) {
        console.log(`[BotResponseDelivery] ⚡ Found ready response for match ${matchId}, delivering immediately`);
        
        try {
          // Get current match to verify it's still active
          const match = await gameManager.getMatch(matchId);
          if (!match || match.endTime <= Date.now()) {
            // Match ended, clean up
            await markBotResponseDelivered(matchId);
            console.log(`[BotResponseDelivery] Match ${matchId} ended, cleaned up response`);
            continue;
          }

          // Deliver the response
          await gameManager.addMessageToMatch(matchId, scheduledBot.response, scheduledBot.botFid);
          await markBotResponseDelivered(matchId);

          // Publish to match channel immediately
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

          // Also publish game event for monitoring
          await eventPublisher.publishChatMessage(
            gameState.cycleId,
            matchId,
            match.player.fid,
            scheduledBot.botFid,
            scheduledBot.response
          );

          console.log(`[BotResponseDelivery] ✓ Immediately delivered bot response for ${matchId}`);
        } catch (error) {
          await recordBotDeliveryFailure(matchId, error instanceof Error ? error : new Error(String(error)));
          console.error(`[BotResponseDelivery] ✗ Failed to deliver response for ${matchId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("[BotResponseDelivery] Error checking scheduled responses:", error);
  }
}

/**
 * Start the background delivery service
 * Checks for ready responses every 500ms to minimize latency
 */
export function startBotResponseDelivery() {
  if (isRunning) {
    console.log("[BotResponseDelivery] Already running");
    return;
  }

  isRunning = true;
  console.log("[BotResponseDelivery] Starting background delivery service (checking every 500ms)");

  checkInterval = setInterval(() => {
    checkAndDeliverReadyResponses().catch(err => {
      console.error("[BotResponseDelivery] Unexpected error:", err);
    });
  }, 500); // Check every 500ms for quick delivery

  // Stop on process exit
  if (typeof process !== "undefined") {
    process.on("exit", stopBotResponseDelivery);
  }
}

/**
 * Stop the background delivery service
 */
export function stopBotResponseDelivery() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  isRunning = false;
  console.log("[BotResponseDelivery] Stopped");
}

/**
 * Check if service is running
 */
export function isBotResponseDeliveryRunning() {
  return isRunning;
}
