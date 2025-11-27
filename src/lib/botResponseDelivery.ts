/**
 * Bot Response Delivery - Background service
 * 
 * Checks for ready bot responses and publishes them immediately via Ably
 * without waiting for client polling. This reduces latency significantly.
 */

import { gameManager } from "./gameState";
import { getScheduledBotResponse, markBotResponseDelivered, recordBotDeliveryFailure } from "./botScheduler";
import { redis } from "./redis";
import * as Ably from "ably";

let isRunning = false;
let checkInterval: NodeJS.Timeout | null = null;
let restClient: Ably.Rest | null = null;

function getRestClient(): Ably.Rest {
  if (!restClient) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) throw new Error("ABLY_API_KEY not configured");
    restClient = new Ably.Rest(apiKey);
  }
  return restClient;
}

/**
 * Check all scheduled bot responses and deliver those that are ready
 */
async function checkAndDeliverReadyResponses() {
  try {
    // Get all scheduled bot responses
    const keys = await redis.keys("bot:scheduled:*");
    
    if (keys.length === 0) return;

    // Batch processing: collect all ready responses first
    const readyResponses: Array<{ matchId: string; scheduledBot: any }> = [];
    
    for (const key of keys) {
      const matchId = key.replace("bot:scheduled:", "");
      const scheduledBot = await getScheduledBotResponse(matchId);

      if (scheduledBot) {
        readyResponses.push({ matchId, scheduledBot });
      }
    }

    // Deliver all ready responses in parallel for speed
    if (readyResponses.length > 0) {
      console.log(`[BotResponseDelivery] ⚡ Batch delivering ${readyResponses.length} responses`);
      
      await Promise.all(readyResponses.map(async ({ matchId, scheduledBot }) => {
        try {
          // Get current match to verify it's still active
          const match = await gameManager.getMatch(matchId);
          if (!match || match.endTime <= Date.now()) {
            // Match ended, clean up
            await markBotResponseDelivered(matchId);
            console.log(`[BotResponseDelivery] Match ${matchId} ended, cleaned up response`);
            return;
          }

          // Deliver the response
          await gameManager.addMessageToMatch(matchId, scheduledBot.response, scheduledBot.botFid);
          
          // Create message immediately with fixed ID for idempotency
          const messageId = `${matchId}-${scheduledBot.botFid}-${Date.now()}`;
          const chatMessage = {
            id: messageId,
            text: scheduledBot.response,
            sender: {
              fid: scheduledBot.botFid,
              username: match.opponent.username,
            },
            timestamp: Date.now(),
          };

          // Publish directly via REST API for fastest delivery (fire and forget)
          const restClient = getRestClient();
          const channel = restClient.channels.get(`match:${matchId}`);
          channel.publish("message", chatMessage).catch(err => {
            console.error(`[BotResponseDelivery] Failed to publish to REST channel: ${err.message}`);
          });

          // Mark as delivered after REST publish (don't wait for response)
          await markBotResponseDelivered(matchId);

          console.log(`[BotResponseDelivery] ⚡ Delivered bot response for ${matchId}`);
        } catch (error) {
          await recordBotDeliveryFailure(matchId, error instanceof Error ? error : new Error(String(error)));
          console.error(`[BotResponseDelivery] ✗ Failed to deliver response for ${matchId}:`, error);
        }
      }));
    }
  } catch (error) {
    console.error("[BotResponseDelivery] Error checking scheduled responses:", error);
  }
}

/**
 * Start the background delivery service
 * Checks for ready responses every 50ms to minimize latency
 */
export function startBotResponseDelivery() {
  if (isRunning) {
    console.log("[BotResponseDelivery] Already running");
    return;
  }

  isRunning = true;
  console.log("[BotResponseDelivery] Starting background delivery service (checking every 50ms)");

  checkInterval = setInterval(() => {
    checkAndDeliverReadyResponses().catch(err => {
      console.error("[BotResponseDelivery] Unexpected error:", err);
    });
  }, 50); // Check every 50ms for ultra-fast delivery

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
