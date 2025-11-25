// src/lib/botScheduler.ts
/**
 * Bot response scheduler with Redis and in-memory fallback.
 * Uses Redis in production, falls back to memory for development.
 */

import { redis } from "./redis";

export interface ScheduledBotResponse {
  matchId: string;
  botFid: number;
  response: string;
  responseTime: number; // Unix timestamp when response should be delivered
  scheduledAt: number; // Unix timestamp when scheduled
  attempts: number; // Number of delivery attempts
  maxRetries: number; // Max delivery attempts before giving up
}

const REDIS_PREFIX = "bot:scheduled";
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000; // 1 second between retries
const RESPONSE_CLEANUP_BUFFER = 60000; // Keep responses 60s after delivery attempt
const DEAD_LETTER_PREFIX = "bot:failed";
const USE_REDIS = process.env.USE_REDIS === "true";

// In-memory fallback for local development
const inMemoryScheduled = new Map<string, ScheduledBotResponse>();
const inMemoryDeadLetter = new Map<string, ScheduledBotResponse & { failureReason: string; failedAt: number }>();

/**
 * Schedule a bot response to be delivered at a specific time
 */
export async function scheduleBotResponse(
  matchId: string,
  botFid: number,
  response: string,
  delayMs: number,
): Promise<void> {
  try {
    const now = Date.now();
    const responseTime = now + delayMs;

    // Safety check: don't schedule if delay is unreasonably long
    if (delayMs > 65000) {
      console.warn(`[botScheduler] Response delay ${delayMs}ms is too long for 60s match, capping to 45s`);
    }
    
    const scheduled: ScheduledBotResponse = {
      matchId,
      botFid,
      response,
      responseTime,
      scheduledAt: now,
      attempts: 0,
      maxRetries: MAX_RETRIES,
    };

    const key = `${REDIS_PREFIX}:${matchId}`;
    const ttl = Math.ceil((delayMs + RESPONSE_CLEANUP_BUFFER) / 1000);

    console.log(`[botScheduler] SCHEDULING bot FID ${botFid} for match ${matchId}`);
    console.log(`[botScheduler] - Response: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`);
    console.log(`[botScheduler] - Delay: ${delayMs}ms, Will deliver at: ${new Date(responseTime).toISOString()}`);
    console.log(`[botScheduler] - Using Redis: ${USE_REDIS}, TTL: ${ttl}s`);

    // Store in Redis with TTL for automatic cleanup
    await redis.setex(
      key,
      ttl,
      JSON.stringify(scheduled)
    );

    console.log(`[botScheduler] ✓ Successfully scheduled bot response for match ${matchId}`);
  } catch (error) {
    console.error(`[botScheduler] ✗ FAILED to schedule bot response for ${matchId}:`, error);
    throw error;
  }
}

/**
 * Get a scheduled bot response if it's ready to deliver
 * Returns null if not scheduled or not ready yet
 */
export async function getScheduledBotResponse(
  matchId: string,
): Promise<{ response: string; botFid: number } | null> {
  try {
    const key = `${REDIS_PREFIX}:${matchId}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    const scheduled: ScheduledBotResponse = JSON.parse(data);
    const now = Date.now();

    // Check if it's time to deliver
    if (now < scheduled.responseTime) {
      const waitMs = scheduled.responseTime - now;
      console.log(`[botScheduler] Response for match ${matchId} not ready yet (waiting ${waitMs}ms)`);
      return null; // Not ready yet
    }

    // Response is ready to deliver
    console.log(`[botScheduler] ✓ READY TO DELIVER bot response for match ${matchId}`);
    console.log(`[botScheduler] - Bot FID: ${scheduled.botFid}`);
    console.log(`[botScheduler] - Response: "${scheduled.response.substring(0, 50)}${scheduled.response.length > 50 ? '...' : ''}"`);

    return {
      response: scheduled.response,
      botFid: scheduled.botFid,
    };
  } catch (error) {
    console.error(`[botScheduler] ✗ FAILED to get scheduled bot response for ${matchId}:`, error);
    return null;
  }
}

/**
 * Mark a response as delivered and clean up
 */
export async function markBotResponseDelivered(matchId: string): Promise<void> {
  try {
    const key = `${REDIS_PREFIX}:${matchId}`;
    await redis.del(key);
    console.log(`[botScheduler] Marked bot response as delivered and cleaned up ${matchId}`);
  } catch (error) {
    console.error(`[botScheduler] Failed to mark bot response as delivered for ${matchId}:`, error);
  }
}

/**
 * Record a failed delivery attempt
 */
export async function recordBotDeliveryFailure(
  matchId: string,
  error: Error,
): Promise<void> {
  try {
    const key = `${REDIS_PREFIX}:${matchId}`;
    const data = await redis.get(key);

    if (!data) {
      return;
    }

    const scheduled: ScheduledBotResponse = JSON.parse(data);
    scheduled.attempts++;

    // If max retries exceeded, move to dead letter queue
    if (scheduled.attempts >= scheduled.maxRetries) {
      const deadLetterKey = `${DEAD_LETTER_PREFIX}:${matchId}`;
      await redis.setex(
        deadLetterKey,
        3600, // Keep failed responses 1 hour
        JSON.stringify({
          ...scheduled,
          failureReason: error.message,
          failedAt: Date.now(),
        })
      );
      console.error(`[botScheduler] Bot response for ${matchId} exceeded max retries, moved to dead letter queue`);
      
      // Delete from scheduled
      await redis.del(key);
    } else {
      // Retry with exponential backoff
      const newResponseTime = Date.now() + (RETRY_BACKOFF_MS * scheduled.attempts);
      scheduled.responseTime = newResponseTime;
      const ttl = Math.ceil((RESPONSE_CLEANUP_BUFFER) / 1000);
      await redis.setex(key, ttl, JSON.stringify(scheduled));
      console.warn(`[botScheduler] Scheduled retry for ${matchId} (attempt ${scheduled.attempts}/${scheduled.maxRetries})`);
    }
  } catch (error) {
    console.error(`[botScheduler] Failed to record delivery failure for ${matchId}:`, error);
  }
}

/**
 * Cancel a scheduled bot response
 */
export async function cancelScheduledBotResponse(matchId: string): Promise<void> {
  try {
    const key = `${REDIS_PREFIX}:${matchId}`;
    await redis.del(key);
    console.log(`[botScheduler] Cancelled scheduled bot response for match ${matchId}`);
  } catch (error) {
    console.error(`[botScheduler] Failed to cancel scheduled bot response for ${matchId}:`, error);
  }
}

/**
 * Get count of pending scheduled responses (for monitoring)
 */
export async function getPendingScheduledCount(): Promise<number> {
  try {
    const keys = await redis.keys(`${REDIS_PREFIX}:*`);
    return keys.length;
  } catch (error) {
    console.error("[botScheduler] Failed to get pending scheduled count:", error);
    return 0;
  }
}

/**
 * Get count of failed responses (for monitoring)
 */
export async function getFailedResponsesCount(): Promise<number> {
  try {
    const keys = await redis.keys(`${DEAD_LETTER_PREFIX}:*`);
    return keys.length;
  } catch (error) {
    console.error("[botScheduler] Failed to get failed responses count:", error);
    return 0;
  }
}

/**
 * Get details of a failed response (for debugging)
 */
export async function getFailedResponseDetails(matchId: string): Promise<any | null> {
  try {
    const key = `${DEAD_LETTER_PREFIX}:${matchId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[botScheduler] Failed to get failed response details for ${matchId}:`, error);
    return null;
  }
}

/**
 * Clear all dead letter queue entries (admin only)
 */
export async function clearDeadLetterQueue(): Promise<number> {
  try {
    const keys = await redis.keys(`${DEAD_LETTER_PREFIX}:*`);
    if (keys.length === 0) return 0;
    
    await redis.del(...keys);
    console.log(`[botScheduler] Cleared ${keys.length} dead letter queue entries`);
    return keys.length;
  } catch (error) {
    console.error("[botScheduler] Failed to clear dead letter queue:", error);
    return 0;
  }
}
