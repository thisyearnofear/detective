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

    // Initialize Ably connection
    useEffect(() => {
        let mounted = true;

        const initializeAbly = async () => {
            try {
                setIsConnecting(true);
                setError(null);

                // Initialize Ably client with token auth
                const client = new Ably.Realtime({
                    authCallback: async (_tokenParams: any, callback: any) => {
                        try {
                            const res = await fetch(`/api/ably/auth?fid=${fid}`);
                            const token = await res.json();
                            callback(null, token);
                        } catch (err) {
                            const errorInfo = { message: (err as Error).message, code: 500, statusCode: 500 };
                            callback(errorInfo, null);
                        }
                    },
                    clientId: `fid:${fid}`,
                    // Auto-reconnect on connection loss
                    disconnectedRetryTimeout: 3000,
                    suspendedRetryTimeout: 10000,
                });

                clientRef.current = client;

                // Connection state listeners
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

                // Subscribe to match channel
                const channel = client.channels.get(`match:${matchId}`);
                channelRef.current = channel;

                // Listen for messages
                await channel.subscribe("message", (message: any) => {
                    if (mounted && message.data) {
                        const chatMessage: ChatMessage = message.data;
                        setMessages((prev) => {
                            // Prevent duplicates
                            if (prev.some((m) => m.id === chatMessage.id)) {
                                return prev;
                            }
                            return [...prev, chatMessage];
                        });
                        onMessage?.(chatMessage);
                    }
                });

                console.log(`[Ably] Subscribed to match:${matchId}`);
            } catch (err) {
                if (mounted) {
                    const error = err instanceof Error ? err : new Error("Failed to initialize Ably");
                    setError(error);
                    setIsConnecting(false);
                    onError?.(error);
                    console.error("[Ably] Initialization error:", error);
                }
            }
        };

        initializeAbly();

        // Cleanup on unmount
        return () => {
            mounted = false;
            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current.detach();
            }
            if (clientRef.current) {
                clientRef.current.close();
            }
        };
    }, [fid, matchId, onMessage, onError]);

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
                onError?.(error);
                throw error;
            }
        },
        [isConnected, onError]
    );

    // Load initial messages (from game state)
    const loadInitialMessages = useCallback((initialMessages: ChatMessage[]) => {
        setMessages(initialMessages);
    }, []);

    return {
        messages,
        sendMessage,
        loadInitialMessages,
        isConnected,
        isConnecting,
        error,
    };
}
