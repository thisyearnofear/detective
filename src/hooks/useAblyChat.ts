// src/hooks/useAblyChat.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as Ably from "ably";
import {
    ChannelNames,
    ChatMessagePayload,
    shouldReceiveMessage,
    getChannelStrategy,
} from "../lib/ablyChannelManager";
import { getAblyChannelService } from "../lib/ablyChannelService";

export type ChatMessage = {
    id: string;
    text: string;
    sender: {
        fid: number;
        username: string;
    };
    timestamp: number;
};

type ChannelStrategy = "shared" | "per-match";

type AblyChatOptions = {
    fid: number;
    matchId: string;
    cycleId?: string; // Required for shared channel strategy
    playerCount?: number; // Used to determine channel strategy
    activeMatchIds?: string[]; // All active match IDs for this player (for shared channel filtering)
    onMessage?: (message: ChatMessage) => void;
    onError?: (error: Error) => void;
};

// Global cache for shared channel match tracking (separate from channel service)
const getGlobalMatchIdCache = () => {
    if (!(globalThis as any).__ABLY_MATCH_IDS__) {
        (globalThis as any).__ABLY_MATCH_IDS__ = {
            sharedChannelMatchIds: new Map<number, Set<string>>(), // fid -> Set of matchIds for shared channel filtering
        };
    }
    return (globalThis as any).__ABLY_MATCH_IDS__ as {
        sharedChannelMatchIds: Map<number, Set<string>>;
    };
};

/**
 * Determine which channel strategy to use
 * - Shared channels: Better for large games (20+ players), uses 3 channels total
 * - Per-match channels: Better for small games, simpler but doesn't scale
 */
const determineStrategy = (playerCount?: number, cycleId?: string): ChannelStrategy => {
    // If no cycleId provided, fall back to per-match
    if (!cycleId) {
        return "per-match";
    }
    // Use the strategy calculator from ablyChannelManager
    return getChannelStrategy(playerCount || 0);
};

/**
 * Custom hook for Ably-powered real-time chat
 *
 * Supports two channel strategies:
 * 1. Per-match channels (default): One channel per match - simple but doesn't scale
 * 2. Shared channels: One channel per game cycle - scales to 1000s of players
 *
 * The strategy is automatically selected based on player count.
 */
export function useAblyChat({
    fid,
    matchId,
    cycleId,
    playerCount,
    activeMatchIds,
    onMessage,
    onError
}: AblyChatOptions) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [strategy, setStrategy] = useState<ChannelStrategy>("per-match");

    const clientRef = useRef<Ably.Realtime | null>(null);
    const channelRef = useRef<Ably.RealtimeChannel | null>(null);
    const onMessageRef = useRef<typeof onMessage | undefined>(onMessage);
    const onErrorRef = useRef<typeof onError | undefined>(onError);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const subscriberIdRef = useRef<string>(`${fid}-${matchId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const matchIdRef = useRef<string>(matchId);
    const activeMatchIdsRef = useRef<string[]>(activeMatchIds || [matchId]);
    const initializingRef = useRef<boolean>(false);
    const strategyRef = useRef<ChannelStrategy>("per-match");

    // Update refs when props change
    useEffect(() => {
        matchIdRef.current = matchId;
    }, [matchId]);

    useEffect(() => {
        activeMatchIdsRef.current = activeMatchIds || [matchId];
    }, [activeMatchIds, matchId]);

    // Determine strategy on mount
    useEffect(() => {
        const newStrategy = determineStrategy(playerCount, cycleId);
        setStrategy(newStrategy);
        strategyRef.current = newStrategy;
        console.log(`[Ably] Using ${newStrategy} channel strategy (playerCount: ${playerCount})`);
    }, [playerCount, cycleId]);

    useEffect(() => {
        let mounted = true;
        let initDebounceTimer: NodeJS.Timeout | null = null;
        const subscriberId = subscriberIdRef.current;
        const currentStrategy = strategyRef.current;
        const channelService = getAblyChannelService();
        const matchIdCache = getGlobalMatchIdCache();

        const initializeAbly = async () => {
            // Prevent duplicate initialization - check both ref and mounted state
            if (initializingRef.current) {
                console.log(`[Ably] Already initializing for FID ${fid}, matchId ${matchId}`);
                return;
            }
            if (!mounted) {
                console.log(`[Ably] Component unmounted before initialization for FID ${fid}, matchId ${matchId}`);
                return;
            }
            initializingRef.current = true;

            try {
                setIsConnecting(true);
                setError(null);

                // Get or create client through service
                const client = await channelService.getOrCreateClient(fid);
                clientRef.current = client;

                const handleConnected = () => {
                    if (mounted) {
                        setIsConnected(true);
                        setIsConnecting(false);
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        console.log(`[Ably] Connected for FID ${fid}`);
                        (globalThis as any).__ABLY_CONNECTED__ = true;
                    }
                };

                const handleDisconnected = () => {
                    if (mounted) {
                        setIsConnected(false);
                        console.log(`[Ably] Disconnected`);
                        (globalThis as any).__ABLY_CONNECTED__ = false;
                    }
                };

                const handleFailed = (stateChange: any) => {
                    if (mounted) {
                        const err = new Error(`Connection failed: ${stateChange.reason?.message || "Unknown error"}`);
                        setError(err);
                        setIsConnected(false);
                        setIsConnecting(false);
                        onErrorRef.current?.(err);
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        console.error("[Ably] Connection failed:", err);
                        (globalThis as any).__ABLY_CONNECTED__ = false;
                    }
                };

                // Remove old listeners before adding new ones
                client.connection.off("connected", handleConnected);
                client.connection.off("disconnected", handleDisconnected);
                client.connection.off("failed", handleFailed);

                client.connection.on("connected", handleConnected);
                client.connection.on("disconnected", handleDisconnected);
                client.connection.on("failed", handleFailed);

                // If already connected, update state immediately
                if (client.connection.state === "connected") {
                    setIsConnected(true);
                    setIsConnecting(false);
                    (globalThis as any).__ABLY_CONNECTED__ = true;
                }

                // Determine channel key based on strategy
                const channelKey = currentStrategy === "shared" && cycleId
                    ? ChannelNames.chat(cycleId)
                    : `match:${matchId}`;

                // Get or attach channel through service
                const channel = await channelService.getOrAttachChannel(fid, channelKey);
                channelRef.current = channel;

                // For shared channels, track which matchIds this FID is interested in
                if (currentStrategy === "shared") {
                    if (!matchIdCache.sharedChannelMatchIds.has(fid)) {
                        matchIdCache.sharedChannelMatchIds.set(fid, new Set());
                    }
                    matchIdCache.sharedChannelMatchIds.get(fid)!.add(matchId);
                }

                // Extended timeout for slower connections
                timeoutRef.current = setTimeout(() => {
                    if (mounted && !isConnected && client?.connection.state !== "connected") {
                        const err = new Error("Connection timeout - switching to polling mode");
                        setError(err);
                        setIsConnecting(false);
                        console.warn("[Ably] Connection timeout after 15s");
                    }
                }, 15000);

                if (!mounted) {
                    initializingRef.current = false;
                    return;
                }

                if (timeoutRef.current) clearTimeout(timeoutRef.current);

                // Subscribe to messages with strategy-aware handler
                const messageHandler = (message: any) => {
                    if (!mounted || !message.data) return;

                    if (currentStrategy === "shared") {
                        // Shared channel: filter messages using shouldReceiveMessage
                        const payload = message.data as ChatMessagePayload;
                        if (payload.type === "chat") {
                            // Check if this message is for one of our active matches
                            if (!shouldReceiveMessage(payload, fid, activeMatchIdsRef.current)) {
                                return; // Not for us
                            }
                            // Only process if it's for the current matchId
                            if (payload.matchId !== matchIdRef.current) {
                                return;
                            }
                            const chatMessage: ChatMessage = payload.message;
                            setMessages((prev) => {
                                if (prev.some((m) => m.id === chatMessage.id)) {
                                    return prev;
                                }
                                return [...prev, chatMessage];
                            });
                            onMessageRef.current?.(chatMessage);
                        }
                    } else {
                        // Per-match channel: direct message handling
                        if (matchIdRef.current !== matchId) return;
                        const chatMessage: ChatMessage = message.data;
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === chatMessage.id)) {
                                return prev;
                            }
                            return [...prev, chatMessage];
                        });
                        onMessageRef.current?.(chatMessage);
                    }
                };

                // Subscribe through service
                await channelService.subscribe(fid, channelKey, subscriberId, messageHandler, "message");
                console.log(`[Ably] Subscribed via service to ${channelKey} (subscriber: ${subscriberId}, strategy: ${currentStrategy})`);

                initializingRef.current = false;
            } catch (err) {
                if (mounted) {
                    const error = err instanceof Error ? err : new Error("Failed to initialize Ably");
                    setError(error);
                    setIsConnecting(false);
                    onErrorRef.current?.(error);
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    console.error("[Ably] Initialization error:", error);
                }
                initializingRef.current = false;
            }
        };

        // Debounce initialization to handle React Strict Mode double-mounting
        // In production, this delay is negligible. In dev with Strict Mode, it prevents
        // rapid mount/unmount/remount from creating multiple connections
        initDebounceTimer = setTimeout(() => {
            initializeAbly();
        }, 50);

        return () => {
            mounted = false;
            initializingRef.current = false;
            if (initDebounceTimer) clearTimeout(initDebounceTimer);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            const channelKey = currentStrategy === "shared" && cycleId
                ? ChannelNames.chat(cycleId)
                : `match:${matchId}`;

            // For shared channels, remove this matchId from tracking
            if (currentStrategy === "shared") {
                const matchIds = matchIdCache.sharedChannelMatchIds.get(fid);
                if (matchIds) {
                    matchIds.delete(matchId);
                    if (matchIds.size === 0) {
                        matchIdCache.sharedChannelMatchIds.delete(fid);
                    }
                }
            }

            // Unsubscribe through service - this handles all detach logic
            channelService.unsubscribe(channelKey, subscriberId);
        };
    }, [fid, matchId, cycleId, strategy]);

    // Send message function - strategy-aware
    const sendMessage = useCallback(
        async (text: string, sender: { fid: number; username: string }) => {
            if (!channelRef.current || !isConnected) {
                throw new Error("Not connected to chat");
            }

            const message: ChatMessage = {
                id: `${Date.now()}-${sender.fid}-${Math.random().toString(36).substr(2, 9)}`,
                text,
                sender,
                timestamp: Date.now(),
            };

            try {
                const channelKey = strategyRef.current === "shared" && cycleId
                    ? ChannelNames.chat(cycleId)
                    : `match:${matchIdRef.current}`;

                if (strategyRef.current === "shared") {
                    // For shared channels, wrap message in ChatMessagePayload format
                    // The server will handle routing, but we need to include metadata
                    const payload: ChatMessagePayload = {
                        type: "chat",
                        matchId: matchIdRef.current,
                        targetFids: [fid], // Will be expanded by server to include opponent
                        message,
                    };
                    await getAblyChannelService().publish(channelKey, "message", payload);
                } else {
                    // Per-match channel: direct message
                    await getAblyChannelService().publish(channelKey, "message", message);
                }
                return message;
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Failed to send message");
                setError(error);
                onErrorRef.current?.(error);
                throw error;
            }
        },
        [isConnected, fid, cycleId]
    );

    // Load initial messages (from game state)
    const loadInitialMessages = useCallback((initialMessages: ChatMessage[]) => {
        setMessages(initialMessages);
    }, []);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    return {
        messages,
        sendMessage,
        loadInitialMessages,
        isConnected,
        isConnecting,
        error,
        strategy, // Expose which strategy is being used
    };
}

/**
 * Hook for subscribing to game events (shared channel only)
 * Use this for round start/end, game start/end notifications
 */
export function useAblyGameEvents({
    fid,
    cycleId,
    enabled = true,
    onEvent,
    onError,
}: {
    fid: number;
    cycleId: string;
    enabled?: boolean;
    onEvent?: (event: { type: string; data: Record<string, any> }) => void;
    onError?: (error: Error) => void;
}) {
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<Ably.Realtime | null>(null);
    const channelRef = useRef<Ably.RealtimeChannel | null>(null);
    const onEventRef = useRef(onEvent);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        // Skip initialization if not enabled or no valid cycleId
        if (!enabled || !cycleId || cycleId === "placeholder") {
            return;
        }

        let mounted = true;
        const channelService = getAblyChannelService();

        const initialize = async () => {
            try {
                // Reuse existing client
                let client = await channelService.getOrCreateClient(fid);
                clientRef.current = client;

                if (client.connection.state === "connected") {
                    setIsConnected(true);
                }

                const channelKey = ChannelNames.events(cycleId);
                const channel = await channelService.getOrAttachChannel(fid, channelKey);
                channelRef.current = channel;

                channel.subscribe("event", (message) => {
                    if (mounted && message.data) {
                        const payload = message.data;
                        // Check if this event is for us
                        if (payload.targetFids && !payload.targetFids.includes(fid)) {
                            return;
                        }
                        onEventRef.current?.({
                            type: payload.event,
                            data: payload.data,
                        });
                    }
                });

                console.log(`[Ably Events] Subscribed to ${channelKey}`);
            } catch (err) {
                if (mounted) {
                    const error = err instanceof Error ? err : new Error("Failed to subscribe to events");
                    onErrorRef.current?.(error);
                    console.error("[Ably Events] Error:", error);
                }
            }
        };

        initialize();

        return () => {
            mounted = false;
            // Don't detach - let the main chat hook manage channel lifecycle
        };
    }, [fid, cycleId, enabled]);

    return { isConnected };
}
