/**
 * Ably Channel Service - Decoupled from React lifecycle
 * 
 * This service manages the lifecycle of Ably channels independently from React components.
 * Channels persist as long as there are active subscribers, not based on component mount/unmount.
 * 
 * This solves the issue where rapid component remounting causes channels to be unnecessarily
 * detached and reattached.
 */

import * as Ably from "ably";

interface ChannelSubscription {
  subscriberId: string;
  onMessage: (message: any) => void;
  messageType: string;
}

interface ManagedChannel {
  channel: Ably.RealtimeChannel;
  subscriptions: Map<string, ChannelSubscription>;
  attachmentPromise?: Promise<void>;
  detachTimeout?: NodeJS.Timeout;
  lastSubscriberRemovalTime?: number;
}

class AblyChannelService {
  private static instance: AblyChannelService;
  private clients: Map<number, Ably.Realtime> = new Map();
  private channels: Map<string, ManagedChannel> = new Map();
  private tokenRequests: Map<number, Promise<any>> = new Map();
  private initialTokens: Map<number, any> = new Map();
  
  // Debounce time before actually detaching a channel (in ms)
  private readonly DETACH_DEBOUNCE_MS = 2000;
  // Maximum time to wait for channel attachment
  private readonly ATTACH_TIMEOUT_MS = 10000;

  private constructor() {}

  static getInstance(): AblyChannelService {
    if (!AblyChannelService.instance) {
      AblyChannelService.instance = new AblyChannelService();
    }
    return AblyChannelService.instance;
  }

  /**
   * Get or create an Ably client for a specific FID
   */
  async getOrCreateClient(fid: number): Promise<Ably.Realtime> {
    let client = this.clients.get(fid);
    if (client) {
      return client;
    }

    console.log(`[AblyChannelService] Creating new client for FID ${fid}`);

    try {
      // Get initial token
      let initialToken: any | null = null;
      let tokenPromise = this.tokenRequests.get(fid);
      
      if (!tokenPromise) {
        tokenPromise = fetch(`/api/ably/auth?fid=${fid}&rnd=${Math.random()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" }
        }).then(res => {
          if (!res.ok) {
            throw new Error(`Auth endpoint unavailable (${res.status})`);
          }
          return res.json();
        });
        this.tokenRequests.set(fid, tokenPromise);
      }

      initialToken = await tokenPromise;
      this.tokenRequests.delete(fid);
      this.initialTokens.set(fid, initialToken);

      // Create client with auth callback
      client = new Ably.Realtime({
        authCallback: async (_tokenParams: any, callback: any) => {
          try {
            const cached = this.initialTokens.get(fid);
            if (cached) {
              this.initialTokens.delete(fid);
              callback(null, cached);
              return;
            }
            const res = await fetch(`/api/ably/auth?fid=${fid}&rnd=${Date.now()}-${Math.random()}`, {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-store",
                "Pragma": "no-cache"
              }
            });
            if (!res.ok) {
              throw new Error(`Auth failed (${res.status})`);
            }
            const token = await res.json();
            callback(null, token);
          } catch (err) {
            const errorInfo = { message: (err as Error).message, code: 500, statusCode: 500 };
            callback(errorInfo, null);
          }
        },
        clientId: `fid:${fid}`,
        autoConnect: true,
        reconnectTimeout: 15000,
        realtimeRequestTimeout: 15000,
        disconnectedRetryTimeout: 3000,
        suspendedRetryTimeout: 10000,
        httpOpenTimeout: 10000,
        transportParams: {
          remainConnectedAfterSuspend: true,
        },
        transports: ["web_socket", "xhr_streaming", "xhr_polling"],
        log: { level: 2 }, // Enable debug logging
      });

      this.clients.set(fid, client);
      return client;
    } catch (err) {
      this.tokenRequests.delete(fid);
      throw err;
    }
  }

  /**
   * Get or attach a channel
   */
  async getOrAttachChannel(fid: number, channelKey: string): Promise<Ably.RealtimeChannel> {
    let managed = this.channels.get(channelKey);

    if (managed) {
      console.log(`[AblyChannelService] Reusing channel ${channelKey}`);
      
      // If we're debouncing detach, cancel it
      if (managed.detachTimeout) {
        clearTimeout(managed.detachTimeout);
        managed.detachTimeout = undefined;
        console.log(`[AblyChannelService] Cancelled pending detach for ${channelKey}`);
      }

      // Wait for attachment if in progress
      if (managed.attachmentPromise) {
        await managed.attachmentPromise;
      }

      return managed.channel;
    }

    // Create new channel
    console.log(`[AblyChannelService] Creating new channel ${channelKey}`);
    const client = await this.getOrCreateClient(fid);
    const channel = client.channels.get(channelKey);

    managed = {
      channel,
      subscriptions: new Map(),
      attachmentPromise: undefined,
    };

    // Attach channel
    if (channel.state !== "attached" && channel.state !== "attaching") {
      managed.attachmentPromise = channel.attach().then(() => {});
    } else if (channel.state === "attaching") {
      managed.attachmentPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Channel attach timeout"));
        }, this.ATTACH_TIMEOUT_MS);

        channel.once("attached", () => {
          clearTimeout(timeout);
          resolve();
        });
        channel.once("failed", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }

    try {
      if (managed.attachmentPromise) {
        await managed.attachmentPromise;
      }
      managed.attachmentPromise = undefined;
    } catch (err) {
      console.error(`[AblyChannelService] Failed to attach channel ${channelKey}:`, err);
      managed.attachmentPromise = undefined;
      throw err;
    }

    this.channels.set(channelKey, managed);
    return channel;
  }

  /**
   * Subscribe to messages on a channel
   */
  async subscribe(
    fid: number,
    channelKey: string,
    subscriberId: string,
    onMessage: (message: any) => void,
    messageType: string = "message"
  ): Promise<void> {
    const channel = await this.getOrAttachChannel(fid, channelKey);
    const managed = this.channels.get(channelKey);

    if (!managed) {
      throw new Error(`Channel ${channelKey} not properly initialized`);
    }

    // Check if already subscribed
    if (managed.subscriptions.has(subscriberId)) {
      console.log(`[AblyChannelService] Subscriber ${subscriberId} already subscribed to ${channelKey}`);
      return;
    }

    // Store subscription
    managed.subscriptions.set(subscriberId, {
      subscriberId,
      onMessage,
      messageType,
    });

    // Subscribe to channel
    channel.subscribe(messageType, onMessage);
    console.log(`[AblyChannelService] Subscribed ${subscriberId} to ${channelKey} (total subscribers: ${managed.subscriptions.size})`);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelKey: string, subscriberId: string): void {
    const managed = this.channels.get(channelKey);
    if (!managed) {
      return;
    }

    const subscription = managed.subscriptions.get(subscriberId);
    if (!subscription) {
      return;
    }

    // Unsubscribe from channel
    managed.channel.unsubscribe(subscription.messageType, subscription.onMessage);
    managed.subscriptions.delete(subscriberId);

    console.log(`[AblyChannelService] Unsubscribed ${subscriberId} from ${channelKey} (remaining: ${managed.subscriptions.size})`);

    // If no more subscribers, schedule detach
    if (managed.subscriptions.size === 0) {
      this.scheduleDetach(channelKey);
    }
  }

  /**
   * Schedule a channel for detachment with debouncing
   * This prevents rapid attach/detach cycles when components remount
   */
  private scheduleDetach(channelKey: string): void {
    const managed = this.channels.get(channelKey);
    if (!managed) {
      return;
    }

    // Clear any pending detach
    if (managed.detachTimeout) {
      clearTimeout(managed.detachTimeout);
    }

    console.log(`[AblyChannelService] Scheduling detach for ${channelKey} in ${this.DETACH_DEBOUNCE_MS}ms`);

    managed.lastSubscriberRemovalTime = Date.now();
    managed.detachTimeout = setTimeout(() => {
      this.performDetach(channelKey);
    }, this.DETACH_DEBOUNCE_MS);
  }

  /**
   * Actually detach the channel
   */
  private performDetach(channelKey: string): void {
    const managed = this.channels.get(channelKey);
    if (!managed) {
      return;
    }

    // Double-check: only detach if still no subscribers
    if (managed.subscriptions.size > 0) {
      console.log(`[AblyChannelService] Aborting detach for ${channelKey} - new subscribers added`);
      managed.detachTimeout = undefined;
      return;
    }

    console.log(`[AblyChannelService] Detaching channel ${channelKey}`);
    
    const state = managed.channel.state as string;
    if (state === "attached" || state === "attaching") {
      managed.channel.detach().catch((err) => {
        console.warn(`[AblyChannelService] Error detaching ${channelKey}:`, err);
      });
    }

    managed.detachTimeout = undefined;
    this.channels.delete(channelKey);
  }

  /**
   * Publish a message to a channel
   */
  async publish(channelKey: string, messageType: string, data: any): Promise<void> {
    const managed = this.channels.get(channelKey);
    if (!managed) {
      throw new Error(`Channel ${channelKey} not found`);
    }
    await managed.channel.publish(messageType, data);
  }

  /**
   * Get channel state for debugging
   */
  getChannelState(channelKey: string): {
    exists: boolean;
    state?: string;
    subscriberCount?: number;
  } {
    const managed = this.channels.get(channelKey);
    if (!managed) {
      return { exists: false };
    }
    return {
      exists: true,
      state: managed.channel.state as string,
      subscriberCount: managed.subscriptions.size,
    };
  }

  /**
   * Get all active channels for debugging
   */
  getAllChannels(): Record<string, any> {
    const result: Record<string, any> = {};
    this.channels.forEach((managed, key) => {
      result[key] = {
        state: managed.channel.state,
        subscriberCount: managed.subscriptions.size,
        subscribers: Array.from(managed.subscriptions.keys()),
      };
    });
    return result;
  }
}

export function getAblyChannelService(): AblyChannelService {
  return AblyChannelService.getInstance();
}

// Export singleton instance
export default getAblyChannelService();
