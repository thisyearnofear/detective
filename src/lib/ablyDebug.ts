/**
 * Ably Channel Service Debug Utilities
 * 
 * Use in browser console to monitor channel state:
 * window.__ablyDebug.getChannelState()
 * window.__ablyDebug.getAllChannels()
 * window.__ablyDebug.getClientState()
 */

import { getAblyChannelService } from "./ablyChannelService";

export function setupAblyDebug() {
  const channelService = getAblyChannelService();

  const debug = {
    // Get state of a specific channel
    getChannelState: (channelKey: string) => {
      const state = channelService.getChannelState(channelKey);
      console.log(`[Ably Debug] Channel ${channelKey}:`, state);
      return state;
    },

    // Get all active channels
    getAllChannels: () => {
      const channels = channelService.getAllChannels();
      console.log("[Ably Debug] All channels:", channels);
      return channels;
    },

    // Print formatted table of channels
    printChannelTable: () => {
      const channels = channelService.getAllChannels();
      console.table(channels);
    },

    // Watch a specific channel for changes (returns cleanup function)
    watchChannel: (channelKey: string, intervalMs = 2000) => {
      const interval = setInterval(() => {
        const state = channelService.getChannelState(channelKey);
        console.log(`[Ably Watch] ${channelKey}:`, state);
      }, intervalMs);

      return () => {
        clearInterval(interval);
        console.log(`[Ably Debug] Stopped watching ${channelKey}`);
      };
    },

    // Watch all channels for changes
    watchAllChannels: (intervalMs = 2000) => {
      let lastState: Record<string, any> = {};

      const interval = setInterval(() => {
        const channels = channelService.getAllChannels();
        const currentState = JSON.stringify(channels);
        const lastStateStr = JSON.stringify(lastState);

        if (currentState !== lastStateStr) {
          console.log("[Ably Watch] Channel state changed:");
          console.table(channels);
          lastState = channels;
        }
      }, intervalMs);

      return () => {
        clearInterval(interval);
        console.log("[Ably Debug] Stopped watching all channels");
      };
    },

    // Get connection state for a FID
    getClientState: (fid: number) => {
      const channels = channelService.getAllChannels();
      const fidChannels = Object.entries(channels).filter(([key]) => 
        !key.includes("game:") // Filter for per-match channels
      );
      console.log(`[Ably Debug] Channels for FID ${fid}:`, fidChannels);
      return fidChannels;
    },

    // Summary of all activity
    getSummary: () => {
      const channels = channelService.getAllChannels();
      const summary = {
        totalChannels: Object.keys(channels).length,
        channelsByState: {} as Record<string, number>,
        totalSubscribers: 0,
      };

      Object.values(channels).forEach((ch: any) => {
        summary.channelsByState[ch.state] = (summary.channelsByState[ch.state] || 0) + 1;
        summary.totalSubscribers += ch.subscriberCount || 0;
      });

      console.log("[Ably Debug] Summary:", summary);
      return summary;
    },
  };

  // Expose on window for easy console access
  (globalThis as any).__ablyDebug = debug;

  return debug;
}

// Call on app initialization
if (typeof window !== "undefined") {
  setupAblyDebug();
}
