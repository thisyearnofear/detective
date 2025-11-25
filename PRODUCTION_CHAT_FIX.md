# Production Chat Crash Fix

## Problem
In production, the chat would launch successfully when the game went live, but would crash/disconnect shortly after. The logs showed:

1. ✅ Chat connects successfully
2. ✅ Channels subscribe correctly  
3. ❌ Immediately unsubscribes from all channels
4. ❌ Game state flips from LIVE → REGISTERING
5. ❌ Chat components unmount

## Root Cause

**SWR polling was causing component unmounting during refetch**

The app polls `/api/game/status` every 3 seconds using SWR. During each refetch:
- SWR clears the old `gameState` data
- Component tree re-renders with `undefined` gameState
- `MultiChatContainer` unmounts (cleanup runs)
- All Ably channels unsubscribe
- New data arrives
- `MultiChatContainer` remounts
- Ably channels resubscribe

This created a **mount/unmount thrashing cycle** every 3 seconds.

## Solution

### 1. **Added `keepPreviousData` to SWR** (src/app/page.tsx, line 45)
```typescript
const { data: gameState } = useSWR(
  `/api/game/status?fid=${sdkUser.fid}`,
  fetcher,
  { 
    refreshInterval: 3000,
    keepPreviousData: true,  // ← Prevents data clearing during refetch
    revalidateOnFocus: false,
  },
);
```

**Result**: gameState stays populated during refetch, preventing component unmount.

### 2. **Added stable React key using cycleId** (src/app/page.tsx, line 20)
```typescript
const LiveGameView = ({ fid, cycleId }: { fid: number; cycleId?: string }) => {
  return <MultiChatContainer key={cycleId || 'live-game'} fid={fid} />;
};
```

**Result**: Component only remounts when cycleId changes (new game), not on every refetch.

### 3. **Disabled focus revalidation** (src/app/page.tsx, line 46)
```typescript
revalidateOnFocus: false
```

**Result**: Tab switching doesn't trigger refetch and component churn.

## Previous Fixes (Still in Place)

These fixes from the earlier development issue still apply:

1. **Single responsive layout** (MultiChatContainer.tsx): 4 ChatWindows → 2
2. **Debounced initialization** (useAblyChat.ts): 50ms debounce prevents React Strict Mode thrashing
3. **Disabled input during connection** (ChatWindow.tsx): Prevents "Not connected" errors

## Impact

### Before
- Chat connects → 3 seconds later → unmounts → reconnects → unmounts → (infinite loop)
- Channels constantly subscribing/unsubscribing
- "Game state flipping" from LIVE to REGISTERING appearance

### After
- Chat connects once and stays connected
- Stable channel subscriptions
- No component remounting during polling
- Only remounts on actual game cycle changes

## Testing

1. **Development**: Verify chat stays connected for >10 seconds without detaching
2. **Production**: Monitor Ably logs - should see single connection, no repeated subscribe/unsubscribe
3. **Tab switching**: Verify chat doesn't disconnect when switching tabs

## Files Changed

- `src/app/page.tsx`: Added `keepPreviousData`, stable key, disabled focus revalidation
- `src/components/MultiChatContainer.tsx`: (Previous fix) Single responsive layout
- `src/hooks/useAblyChat.ts`: (Previous fix) Debounced initialization
- `src/components/ChatWindow.tsx`: (Previous fix) Enhanced connection state checks

## Why This Works

SWR's `keepPreviousData` is specifically designed for lists and polling scenarios where you want to:
- Show stale data while fetching fresh data
- Prevent loading states during refetch
- **Prevent component unmounting during refetch** ← Our exact need

Combined with a stable React key based on `cycleId`, React now only remounts the chat when the game cycle actually changes, not on every 3-second poll.
