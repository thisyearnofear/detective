/**
 * Connection Prewarming - Establish Ably connection early
 * 
 * Before the user enters a match, establish the Ably connection
 * so that when they actually need to chat, it's already ready.
 * This eliminates cold-start latency.
 */

import { getAblyChannelService } from "./ablyChannelService";

/**
 * Preconnect to Ably before a match starts
 * Call this as soon as the game round begins to establish connection early
 */
export async function prewarmAblyConnection(fid: number): Promise<void> {
  try {
    const channelService = getAblyChannelService();
    
    // Just creating/getting the client and channel warms up the connection
    // This happens in parallel without blocking
    await Promise.race([
      (async () => {
        try {
          await channelService.getOrCreateClient(fid);
          console.log(`[ConnectionPrewarm] ✓ Ably client ready for FID ${fid}`);
        } catch (err) {
          console.warn(`[ConnectionPrewarm] Failed to create client: ${err}`);
        }
      })(),
      // Timeout after 2 seconds so we don't block the UI
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  } catch (err) {
    console.warn(`[ConnectionPrewarm] Prewarming failed (non-critical):`, err);
    // Non-critical - connection will still work, just with initial latency
  }
}

/**
 * Preconnect to a specific channel
 * Call this when navigating to the game component
 */
export async function prewarmChannel(
  fid: number,
  channelKey: string
): Promise<void> {
  try {
    const channelService = getAblyChannelService();
    
    await Promise.race([
      (async () => {
        try {
          await channelService.getOrAttachChannel(fid, channelKey);
          console.log(`[ConnectionPrewarm] ✓ Channel ${channelKey} ready`);
        } catch (err) {
          console.warn(`[ConnectionPrewarm] Failed to attach channel: ${err}`);
        }
      })(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  } catch (err) {
    console.warn(`[ConnectionPrewarm] Channel prewarming failed (non-critical):`, err);
  }
}
