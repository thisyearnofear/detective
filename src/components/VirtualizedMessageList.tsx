/**
 * VIRTUALIZED MESSAGE LIST
 * High-performance message rendering for mobile with virtual scrolling
 */

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useViewport, responsive } from '@/lib/viewport';
import { useVirtualKeyboard } from '@/lib/mobile';
import { globalCache } from '@/lib/cache';

interface Message {
  id: string;
  text: string;
  sender: {
    fid: number;
    username: string;
  };
  timestamp: number;
}

interface Props {
  messages: Message[];
  currentUserId: number;
  containerHeight: string;
  opponentColors?: {
    primary: [number, number, number];
    secondary: [number, number, number];
  };
}

const ITEM_HEIGHT = 60; // Average message height
const OVERSCAN = 5; // Render extra items outside viewport

// MEMOIZED MESSAGE COMPONENT
const MessageBubble = memo(({ 
  message, 
  isCurrentUser, 
  opponentColors, 
  isFarcasterFrame 
}: {
  message: Message;
  isCurrentUser: boolean;
  opponentColors?: { primary: [number, number, number]; secondary: [number, number, number] };
  isFarcasterFrame: boolean;
}) => {
  return (
    <div className={`flex flex-col ${isCurrentUser ? "items-end" : "items-start"} mb-2`}>
      <div
        className={`${
          isFarcasterFrame ? "max-w-[85%]" : "max-w-xs md:max-w-md"
        } rounded-lg ${
          isFarcasterFrame ? "px-2 py-1" : "px-3 py-2"
        } ${isCurrentUser ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-200"}`}
        style={
          !isCurrentUser && opponentColors
            ? {
                backgroundColor: `rgba(${opponentColors.primary[0]}, ${opponentColors.primary[1]}, ${opponentColors.primary[2]}, 0.15)`,
                borderLeft: `3px solid rgb(${opponentColors.primary[0]}, ${opponentColors.primary[1]}, ${opponentColors.primary[2]})`,
              }
            : {}
        }
      >
        <p className={isFarcasterFrame ? responsive.text.small : responsive.text.medium}>
          {message.text}
        </p>
      </div>
      {!isFarcasterFrame && (
        <span className="text-xs text-gray-500 mt-1">@{message.sender.username}</span>
      )}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default function VirtualizedMessageList({
  messages,
  currentUserId,
  containerHeight,
  opponentColors,
}: Props) {
  const { isFarcasterFrame } = useViewport();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightPx, setContainerHeightPx] = useState(300);
  
  // Virtual keyboard handling
  const isKeyboardOpen = useVirtualKeyboard((isOpen) => {
    if (isOpen && containerRef.current) {
      // Auto-scroll to bottom when keyboard opens
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  });

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    messages.length - 1,
    Math.ceil((scrollTop + containerHeightPx) / ITEM_HEIGHT) + OVERSCAN
  );

  const visibleMessages = messages.slice(startIndex, endIndex + 1);
  const totalHeight = messages.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  // Update container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeightPx(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Throttled scroll handler
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = (e: Event) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll(e);
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      const isNearBottom = 
        scrollTop + containerHeightPx >= totalHeight - ITEM_HEIGHT * 2;
      
      if (isNearBottom) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }
  }, [messages.length, scrollTop, containerHeightPx, totalHeight]);

  // Cache rendered messages for performance
  const renderedMessages = visibleMessages.map((message, index) => {
    const cacheKey = `msg_${message.id}_${isFarcasterFrame}`;
    
    return (
      <div
        key={message.id}
        style={{
          position: 'absolute',
          top: (startIndex + index) * ITEM_HEIGHT,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
        }}
      >
        <MessageBubble
          message={message}
          isCurrentUser={message.sender.fid === currentUserId}
          opponentColors={opponentColors}
          isFarcasterFrame={isFarcasterFrame}
        />
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      className={`${containerHeight} overflow-y-auto bg-slate-900/50 rounded-lg relative`}
      style={{
        // Adjust height when virtual keyboard is open
        height: isKeyboardOpen ? 'calc(100% - 280px)' : undefined,
      }}
    >
      {/* Virtual scrolling container */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {renderedMessages}
      </div>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 text-center">
            Say hello! Your conversation starts now.
          </p>
        </div>
      )}
    </div>
  );
}