/**
 * VIRTUALIZED MESSAGE LIST
 * High-performance message rendering for mobile with virtual scrolling
 */

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useViewport, responsive } from '@/lib/viewport';
import { useVirtualKeyboard } from '@/lib/mobile';

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

// Dynamic item heights - messages vary in length
const BASE_ITEM_HEIGHT = 60;
const OVERSCAN = 3; // Render extra items outside viewport
const PADDING_PER_ITEM = 8; // p-2 = 8px

// Helper to estimate message height based on text length
function estimateMessageHeight(text: string): number {
  const charCount = text.length;
  // Rough estimate: ~40 chars per line at typical width
  const estimatedLines = Math.ceil(charCount / 40) || 1;
  return Math.max(BASE_ITEM_HEIGHT, estimatedLines * 24 + PADDING_PER_ITEM);
}

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

  // Calculate dynamic heights for all messages
  const messageHeights = messages.map(msg => estimateMessageHeight(msg.text));
  const cumulativeHeights = messageHeights.reduce((acc, height, i) => {
    acc[i] = (acc[i - 1] || 0) + height;
    return acc;
  }, {} as Record<number, number>);

  // Find visible range based on scroll position
  let startIndex = 0;
  let endIndex = messages.length - 1;
  
  for (let i = 0; i < messages.length; i++) {
    if (cumulativeHeights[i] >= scrollTop - BASE_ITEM_HEIGHT * OVERSCAN) {
      startIndex = Math.max(0, i - OVERSCAN);
      break;
    }
  }
  
  for (let i = startIndex; i < messages.length; i++) {
    if (cumulativeHeights[i] >= scrollTop + containerHeightPx) {
      endIndex = Math.min(messages.length - 1, i + OVERSCAN);
      break;
    }
  }

  const visibleMessages = messages.slice(startIndex, endIndex + 1);
  const totalHeight = cumulativeHeights[messages.length - 1] || 0;

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
        scrollTop + containerHeightPx >= totalHeight - BASE_ITEM_HEIGHT * 2;
      
      if (isNearBottom) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }
  }, [messages.length, scrollTop, containerHeightPx, totalHeight]);

  // Cache rendered messages for performance with dynamic heights
  const renderedMessages = visibleMessages.map((message, index) => {
    const messageIndex = startIndex + index;
    const topPosition = cumulativeHeights[messageIndex - 1] || 0;
    const messageHeight = messageHeights[messageIndex];
    
    return (
      <div
        key={message.id}
        style={{
          position: 'absolute',
          top: topPosition,
          left: 0,
          right: 0,
          height: messageHeight,
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