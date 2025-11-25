// src/hooks/useAblyChat.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as Ably from "ably";

export type ChatMessage = {
    id: string;
    text: string;
    sender: {
        fid: number;
        username: string;
    };
    timestamp: number;
};

type AblyChatOptions = {
    fid: number;
    matchId: string;
    onMessage?: (message: ChatMessage) => void;
    onError?: (error: Error) => void;
};

/**
 * Custom hook for Ably-powered real-time chat
 * 
 * Manages WebSocket connection, message sending/receiving, and automatic reconnection.
 */
export function useAblyChat({ fid, matchId, onMessage, onError }: AblyChatOptions) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const clientRef = useRef<Ably.Realtime | null>(null);
    const channelRef = useRef<Ably.RealtimeChannel | null>(null);
    const onMessageRef = useRef<typeof onMessage | undefined>(onMessage);
    const onErrorRef = useRef<typeof onError | undefined>(onError);

    const globalAblyCache: { clients: Map<number, Ably.Realtime>, initialTokens: Map<number, any> } = (globalThis as any).__ABLY_CACHE__ || { clients: new Map(), initialTokens: new Map() };
    (globalThis as any).__ABLY_CACHE__ = globalAblyCache;

    useEffect(() => {
        let mounted = true;

        const initializeAbly = async () => {
            try {
                setIsConnecting(true);
                setError(null);
                
                let client = globalAblyCache.clients.get(fid) || null;

                if (!client) {
                    let initialToken: any | null = null;
                    try {
                        const res = await fetch(`/api/ably/auth?fid=${fid}`);
                        if (!res.ok) {
                            throw new Error(`Auth endpoint unavailable (${res.status})`);
                        }
                        initialToken = await res.json();
                        globalAblyCache.initialTokens.set(fid, initialToken);
                    } catch (prefetchErr: any) {
                        const err = new Error(prefetchErr.message || "Failed to initialize Ably");
                        setError(err);
                        setIsConnecting(false);
                        onError?.(err);
                        return;
                    }

                    client = new Ably.Realtime({
                        authCallback: async (_tokenParams: any, callback: any) => {
                            try {
                                const cached = globalAblyCache.initialTokens.get(fid);
                                if (cached) {
                                    globalAblyCache.initialTokens.delete(fid);
                                    callback(null, cached);
                                    return;
                                }
                                const res = await fetch(`/api/ably/auth?fid=${fid}`);
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
                        disconnectedRetryTimeout: 3000,
                        suspendedRetryTimeout: 10000,
                        transportParams: {
                            remainConnectedAfterSuspend: true,
                        },
                    });

                    globalAblyCache.clients.set(fid, client);
                }

                clientRef.current = client;

                client.connection.on("connected", () => {
                    if (mounted) {
                        setIsConnected(true);
                        setIsConnecting(false);
                        console.log(`[Ably] Connected for FID ${fid}`);
                    }
                });

                client.connection.on("disconnected", () => {
                    if (mounted) {
                        setIsConnected(false);
                        console.log(`[Ably] Disconnected`);
                    }
                });

                client.connection.on("failed", (stateChange: any) => {
                    if (mounted) {
                        const err = new Error(`Connection failed: ${stateChange.reason?.message || "Unknown error"}`);
                        setError(err);
                        setIsConnected(false);
                        setIsConnecting(false);
                        onError?.(err);
                    }
                });

                const channel = client.channels.get(`match:${matchId}`);
                channelRef.current = channel;

                if (channel.state !== "attached") {
                    await channel.attach();
                }
                if (!mounted) return;

                channel.unsubscribe();
                channel.subscribe("message", (message: any) => {
                    if (mounted && message.data) {
                        const chatMessage: ChatMessage = message.data;
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === chatMessage.id)) {
                                return prev;
                            }
                            return [...prev, chatMessage];
                        });
                        onMessageRef.current?.(chatMessage);
                    }
                });

                console.log(`[Ably] Subscribed to match:${matchId}`);
            } catch (err) {
                if (mounted) {
                    const error = err instanceof Error ? err : new Error("Failed to initialize Ably");
                    setError(error);
                    setIsConnecting(false);
                    onErrorRef.current?.(error);
                    console.error("[Ably] Initialization error:", error);
                }
            }
        };

        initializeAbly();

        return () => {
            mounted = false;
            if (channelRef.current) {
                const ch = channelRef.current;
                ch.unsubscribe();
                const st = ch.state as string;
                console.log(`[Ably] Cleanup for match:${matchId} state=${st}`);
                if (st === "attached" || st === "attaching") {
                    if (st === "attaching") {
                        setTimeout(() => {
                            if (channelRef.current === ch) {
                                const nowState = ch.state as string;
                                if (nowState === "attached" || nowState === "attaching") {
                                    Promise.resolve(ch.detach()).catch(() => {});
                                }
                            }
                        }, 200);
                    } else {
                        Promise.resolve(ch.detach()).catch(() => {});
                    }
                }
            }
        };
    }, [fid, matchId]);

    // Send message function
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
                await channelRef.current.publish("message", message);
                return message;
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Failed to send message");
                setError(error);
                onErrorRef.current?.(error);
                throw error;
            }
        },
        [isConnected]
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
    };
}
