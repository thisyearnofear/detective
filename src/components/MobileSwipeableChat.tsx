"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTouchGestures, useHaptics } from "@/lib/mobile";
import { useViewport } from "@/lib/viewport";
import ChatWindow from "./ChatWindow";
import { UserProfile } from "@/lib/types";

interface Match {
    id: string;
    opponent: UserProfile;
    endTime: number;
    slotNumber?: number;
    messages?: any[];
    voteLocked?: boolean;
}

interface MobileSwipeableChatProps {
    fid: number;
    slots: Record<number, Match>;
    votes: Record<string, "REAL" | "BOT">;
    newMatchIds: Set<string>;
    typingIndicators: Record<string, boolean>;
    onVoteToggle: (matchId: string) => void;
    onMatchComplete: (matchId: string) => void;
    onTypingStart: (matchId: string, duration: number) => void;
    onRefresh: () => Promise<void>;
    currentRound: number;
    totalRounds: number;
    monetizationEnabled?: boolean;
}

export default function MobileSwipeableChat({
    fid,
    slots,
    votes,
    newMatchIds,
    typingIndicators,
    onVoteToggle,
    onMatchComplete,
    onTypingStart,
    onRefresh,
    currentRound,
    totalRounds,
    monetizationEnabled = true,
}: MobileSwipeableChatProps) {
    const { isMobile } = useViewport();
    const haptics = useHaptics();
    const [activeSlot, setActiveSlot] = useState<1 | 2>(1);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track new messages per slot for notification badges
    const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({ 1: 0, 2: 0 });
    const lastMessageCounts = useRef<Record<number, number>>({ 1: 0, 2: 0 });

    // Detect new messages and update unread counts
    useEffect(() => {
        [1, 2].forEach((slotNum) => {
            const match = slots[slotNum];
            if (!match) return;

            const currentCount = match.messages?.length || 0;
            const previousCount = lastMessageCounts.current[slotNum] || 0;

            if (currentCount > previousCount && slotNum !== activeSlot) {
                // New message in inactive slot
                setUnreadCounts((prev) => ({
                    ...prev,
                    [slotNum]: (prev[slotNum] || 0) + (currentCount - previousCount),
                }));
                // Trigger haptic feedback
                haptics("medium");
            }

            lastMessageCounts.current[slotNum] = currentCount;
        });
    }, [slots[1]?.messages?.length, slots[2]?.messages?.length, activeSlot, haptics]);

    // Clear unread count when slot becomes active
    useEffect(() => {
        setUnreadCounts((prev) => ({
            ...prev,
            [activeSlot]: 0,
        }));
    }, [activeSlot]);

    // Track swipe progress for visual feedback
    const [swipeProgress, setSwipeProgress] = useState(0);

    // Handle swipe gesture
    const onGesture = useCallback(
        (gesture: { type: string; direction?: string; progress?: number }) => {
            if (gesture.type === "swipe-progress") {
                // Show preview of next slot as user swipes
                setSwipeProgress(gesture.progress || 0);
            } else if (gesture.type === "swipe" && !isAnimating) {
                setSwipeProgress(0); // Reset preview
                if (gesture.direction === "left" && activeSlot === 1) {
                    setIsAnimating(true);
                    setActiveSlot(2);
                    haptics("light");
                    setTimeout(() => setIsAnimating(false), 300);
                } else if (gesture.direction === "right" && activeSlot === 2) {
                    setIsAnimating(true);
                    setActiveSlot(1);
                    haptics("light");
                    setTimeout(() => setIsAnimating(false), 300);
                }
            } else if (gesture.type === "tap") {
                setSwipeProgress(0); // Clear preview on tap
            }
        },
        [activeSlot, isAnimating, haptics]
    );

    const { handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchGestures(onGesture, {
        swipeThreshold: 40,
    });

    // Add touch listeners to container
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isMobile) return;

        container.addEventListener("touchstart", handleTouchStart as any);
        container.addEventListener("touchmove", handleTouchMove as any, { passive: true });
        container.addEventListener("touchend", handleTouchEnd as any);

        return () => {
            container.removeEventListener("touchstart", handleTouchStart as any);
            container.removeEventListener("touchmove", handleTouchMove as any);
            container.removeEventListener("touchend", handleTouchEnd as any);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, isMobile]);

    const match1 = slots[1];
    const match2 = slots[2];

    return (
        <div className="flex flex-col h-full" ref={containerRef}>
            {/* Header with slot tabs and round info */}
            <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-3 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700">
                {/* Round indicator */}
                <span className="bg-slate-700 px-3 py-1 rounded-full text-xs text-blue-300 font-medium whitespace-nowrap">
                    Round {Math.min(currentRound, totalRounds)}/{totalRounds}
                </span>

                {/* Slot tabs - responsive sizing */}
                <div className="flex bg-slate-900 rounded-full p-1 gap-1 flex-shrink-0">
                    {[1, 2].map((slotNum) => {
                        const isActive = activeSlot === slotNum;
                        const hasUnread = unreadCounts[slotNum] > 0;
                        const match = slots[slotNum];
                        const vote = match ? votes[match.id] : "REAL";

                        return (
                            <button
                                key={slotNum}
                                onClick={() => {
                                    if (!isAnimating && slotNum !== activeSlot) {
                                        setIsAnimating(true);
                                        setActiveSlot(slotNum as 1 | 2);
                                        haptics("light");
                                        setTimeout(() => setIsAnimating(false), 300);
                                    }
                                }}
                                className={`
                  relative px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 whitespace-nowrap
                  ${isActive
                                        ? `bg-gradient-to-r ${vote === "BOT" ? "from-red-600 to-red-700" : "from-green-600 to-green-700"} text-white shadow-lg`
                                        : "text-gray-400 hover:text-white"
                                    }
                `}
                            >
                                Chat {slotNum}
                                {/* Unread indicator dot (simplified from count) */}
                                {hasUnread && !isActive && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                                )}
                                {/* Typing indicator dot */}
                                {match && typingIndicators[match.id] && !isActive && (
                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Enhanced swipe hint - more visible with animation */}
                <div className="text-xs text-blue-400 font-medium opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap animate-pulse">
                    ← swipe →
                </div>
            </div>

            {/* Chat Cards Container */}
            <div className="flex-1 relative overflow-hidden">
                {/* Slot 1 */}
                <div
                    className={`
            absolute inset-0 transition-all duration-300 ease-out
            ${activeSlot === 1 ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}
            ${swipeProgress > 0 && activeSlot === 1 ? "transition-none" : ""}
          `}
                    style={
                        swipeProgress > 0 && activeSlot === 1
                            ? { transform: `translateX(${Math.min(swipeProgress * 2, 100)}%)` }
                            : {}
                    }
                >
                    {match1 ? (
                        <ChatWindow
                            fid={fid}
                            match={match1}
                            currentVote={votes[match1.id] || "REAL"}
                            onVoteToggle={() => onVoteToggle(match1.id)}
                            onComplete={() => onMatchComplete(match1.id)}
                            variant="minimal"
                            showVoteToggle={true}
                            isNewMatch={newMatchIds.has(match1.id)}
                            onRefresh={onRefresh}
                            isOpponentTyping={typingIndicators[match1.id] || false}
                            onTypingStart={onTypingStart}
                            monetizationEnabled={monetizationEnabled}
                        />
                    ) : (
                        <EmptySlot slotNumber={1} />
                    )}
                </div>

                {/* Slot 2 */}
                <div
                    className={`
            absolute inset-0 transition-all duration-300 ease-out
            ${activeSlot === 2 ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
            ${swipeProgress > 0 && activeSlot === 2 ? "transition-none" : ""}
          `}
                    style={
                        swipeProgress > 0 && activeSlot === 2
                            ? { transform: `translateX(-${Math.min(swipeProgress * 2, 100)}%)` }
                            : {}
                    }
                >
                    {match2 ? (
                        <ChatWindow
                            fid={fid}
                            match={match2}
                            currentVote={votes[match2.id] || "REAL"}
                            onVoteToggle={() => onVoteToggle(match2.id)}
                            onComplete={() => onMatchComplete(match2.id)}
                            variant="minimal"
                            showVoteToggle={true}
                            isNewMatch={newMatchIds.has(match2.id)}
                            onRefresh={onRefresh}
                            isOpponentTyping={typingIndicators[match2.id] || false}
                            onTypingStart={onTypingStart}
                            monetizationEnabled={monetizationEnabled}
                        />
                    ) : (
                        <EmptySlot slotNumber={2} />
                    )}
                </div>
            </div>

            {/* Bottom page indicator dots */}
            <div className="flex justify-center gap-2 py-3 bg-slate-800/50 border-t border-slate-700/50">
                <div
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${activeSlot === 1 ? "w-4 bg-blue-500" : "bg-slate-600"
                        }`}
                />
                <div
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${activeSlot === 2 ? "w-4 bg-blue-500" : "bg-slate-600"
                        }`}
                />
            </div>
        </div>
    );
}

function EmptySlot({ slotNumber }: { slotNumber: number }) {
    return (
        <div className="h-full flex items-center justify-center bg-slate-800/50">
            <div className="text-center text-gray-500 p-8">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-lg font-medium mb-1">Chat Slot {slotNumber}</p>
                <p className="text-sm">Waiting for opponent...</p>
            </div>
        </div>
    );
}
