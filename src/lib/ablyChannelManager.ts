// src/lib/ablyChannelManager.ts
/**
 * Ably Channel Manager for Horizontal Scaling
 * 
 * Instead of creating a unique channel per match (which doesn't scale),
 * this manager uses a smaller number of shared channels with message routing.
 * 
 * Architecture:
 * - game:{cycleId}:chat - Main chat channel for all messages
 * - game:{cycleId}:events - Game events (round start, match end, etc.)
 * - game:{cycleId}:presence - Player presence tracking
 * 
 * Messages are routed to specific players using targetFid in the message data.
 */

import * as Ably from "ably";

// Channel naming conventions
export const ChannelNames = {
    // Shared chat channel for a game cycle
    chat: (cycleId: string) => `game:${cycleId}:chat`,

    // Game events channel
    events: (cycleId: string) => `game:${cycleId}:events`,

    // Presence channel for online status
    presence: (cycleId: string) => `game:${cycleId}:presence`,

    // Legacy per-match channel (for backward compatibility)
    match: (matchId: string) => `match:${matchId}`,
};

// Message types for the shared channel
export type ChatMessagePayload = {
    type: "chat";
    matchId: string;
    targetFids: number[]; // FIDs that should receive this message
    message: {
        id: string;
        text: string;
        sender: {
            fid: number;
            username: string;
        };
        timestamp: number;
    };
};

export type GameEventPayload = {
    type: "event";
    event:
    | "round_start"
    | "round_end"
    | "match_start"
    | "match_end"
    | "game_start"
    | "game_end"
    | "vote_locked";
    targetFids?: number[]; // If undefined, broadcast to all
    data: Record<string, any>;
};

export type PresencePayload = {
    type: "presence";
    fid: number;
    status: "online" | "offline" | "away";
    lastSeen: number;
};

export type ChannelPayload = ChatMessagePayload | GameEventPayload | PresencePayload;

/**
 * Server-side Ably manager for publishing messages
 */
export class AblyServerManager {
    private client: Ably.Rest | null = null;
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.ABLY_API_KEY;
    }

    private getClient(): Ably.Rest {
        if (!this.client) {
            if (!this.apiKey) {
                throw new Error("ABLY_API_KEY not configured");
            }
            this.client = new Ably.Rest(this.apiKey);
        }
        return this.client;
    }

    /**
     * Publish a chat message to the shared channel
     */
    async publishChatMessage(
        cycleId: string,
        matchId: string,
        targetFids: number[],
        message: ChatMessagePayload["message"]
    ): Promise<void> {
        const client = this.getClient();
        const channel = client.channels.get(ChannelNames.chat(cycleId));

        const payload: ChatMessagePayload = {
            type: "chat",
            matchId,
            targetFids,
            message,
        };

        await channel.publish("message", payload);
    }

    /**
     * Publish a game event
     */
    async publishGameEvent(
        cycleId: string,
        event: GameEventPayload["event"],
        data: Record<string, any>,
        targetFids?: number[]
    ): Promise<void> {
        const client = this.getClient();
        const channel = client.channels.get(ChannelNames.events(cycleId));

        const payload: GameEventPayload = {
            type: "event",
            event,
            targetFids,
            data,
        };

        await channel.publish("event", payload);
    }

    /**
     * Publish to legacy per-match channel (for backward compatibility)
     */
    async publishToMatchChannel(
        matchId: string,
        message: ChatMessagePayload["message"]
    ): Promise<void> {
        const client = this.getClient();
        const channel = client.channels.get(ChannelNames.match(matchId));
        await channel.publish("message", message);
    }

    /**
     * Generate a token for client authentication
     */
    async generateToken(
        fid: number,
        _cycleId?: string
    ): Promise<Ably.TokenDetails> {
        const client = this.getClient();

        // Define capabilities based on whether we're using shared or per-match channels
        const capabilities = {
            // Allow subscribing to shared channels
            "game:*:chat": ["subscribe"] as const,
            "game:*:events": ["subscribe"] as const,
            "game:*:presence": ["subscribe", "presence"] as const,
            // Allow publishing to match channels (for backward compatibility)
            "match:*": ["subscribe", "publish", "presence"] as const,
        };

        const tokenDetails = await client.auth.requestToken({
            clientId: `fid:${fid}`,
            capability: capabilities as any,
            ttl: 60 * 60 * 1000, // 1 hour
        });

        return tokenDetails;
    }
}

/**
 * Client-side message filter
 * Filters messages from shared channels to only show relevant ones
 */
export function shouldReceiveMessage(
    payload: ChannelPayload,
    myFid: number,
    myMatchIds: string[]
): boolean {
    if (payload.type === "chat") {
        // Check if this message is for one of my matches
        if (!myMatchIds.includes(payload.matchId)) {
            return false;
        }
        // Check if I'm a target
        return payload.targetFids.includes(myFid);
    }

    if (payload.type === "event") {
        // Broadcast events go to everyone
        if (!payload.targetFids) {
            return true;
        }
        // Targeted events check FID
        return payload.targetFids.includes(myFid);
    }

    if (payload.type === "presence") {
        // Presence updates are always received
        return true;
    }

    return false;
}

/**
 * Calculate optimal channel strategy based on player count
 */
export function getChannelStrategy(playerCount: number): "shared" | "per-match" {
    // Use shared channels when player count is high
    // Per-match channels are fine for small games but don't scale
    if (playerCount > 20) {
        return "shared";
    }
    return "per-match";
}

/**
 * Estimate Ably channel/connection usage
 */
export function estimateAblyUsage(
    playerCount: number,
    matchesPerRound: number,
    totalRounds: number,
    strategy: "shared" | "per-match"
): {
    channels: number;
    peakConnections: number;
    messagesPerMinute: number;
} {
    if (strategy === "shared") {
        return {
            channels: 3, // chat, events, presence
            peakConnections: playerCount,
            messagesPerMinute: playerCount * 2 * matchesPerRound, // Estimate 2 messages per player per match per minute
        };
    }

    // Per-match strategy
    const totalMatches = playerCount * matchesPerRound * totalRounds / 2; // Divide by 2 since each match has 2 players
    return {
        channels: totalMatches,
        peakConnections: playerCount,
        messagesPerMinute: playerCount * 2 * matchesPerRound,
    };
}

// Export singleton for server-side use
let serverManager: AblyServerManager | null = null;

export function getAblyServerManager(): AblyServerManager {
    if (!serverManager) {
        serverManager = new AblyServerManager();
    }
    return serverManager;
}

export default getAblyServerManager;