# Chat Disappearing Issue - Fix Documentation

## Problem

The chat windows on the right side were flashing in and out, appearing and disappearing repeatedly during gameplay.

### Root Cause

The issue was caused by **React component re-mounting** triggered by object reference changes:

1. **Polling Behavior**: `MultiChatContainer` polls `/api/match/active` every 5 seconds
2. **Object Reference Changes**: Each API response creates new match objects with different references, even if the content is identical
3. **React Re-rendering**: React's reconciliation sees these as "new" matches and re-mounts the `ChatWindow` components
4. **Ably Subscription Churn**: Each re-mount causes:
   - Unsubscribe from Ably channel
   - Schedule channel detachment (2 second debounce)
   - Re-subscribe to the same channel
   - Cancel detachment and re-attach

This created a rapid subscribe/unsubscribe cycle visible in the console:

```
[AblyChannelService] Subscribed ... to match:... (total subscribers: 2)
[AblyChannelService] Unsubscribed ... from match:... (remaining: 1)
[AblyChannelService] Unsubscribed ... from match:... (remaining: 0)
[AblyChannelService] Scheduling detach for match:... in 2000ms
[AblyChannelService] Detaching channel match:...
[AblyChannelService] Creating new channel match:...
```

## Solution

Implemented **stable object references** using React's `useMemo` and `useRef` to prevent unnecessary re-mounts:

### Changes Made

**File**: `src/components/MultiChatContainer.tsx`

1. **Added `useMemo` import** (line 3)
2. **Created stable slots memoization** (lines 360-409):
   - Uses a `useRef` to maintain previous slot references
   - Only creates new slot objects when actual content changes (match ID, vote lock status, message count)
   - Reuses previous object references when content is identical
   - Prevents React from seeing "new" matches on every poll

### How It Works

```typescript
const previousSlotsRef = useRef<any>({});
const stableSlots = useMemo(() => {
  // For each slot (1 and 2):
  // - Compare current match with previous match
  // - If ID, voteLocked, or message count changed → use new reference
  // - If nothing changed → reuse previous reference (prevents re-mount)
  
  // Only update the ref when actual changes detected
  if (hasChanges) {
    previousSlotsRef.current = newSlots;
    return newSlots;
  }
  
  return previousSlotsRef.current; // Stable reference
}, [
  slots[1]?.id,
  slots[2]?.id,
  slots[1]?.voteLocked,
  slots[2]?.voteLocked,
  slots[1]?.messages?.length,
  slots[2]?.messages?.length,
]);
```

### Benefits

✅ **Eliminates chat flashing**: ChatWindow components no longer re-mount on every poll  
✅ **Reduces Ably churn**: Subscriptions remain stable across re-renders  
✅ **Improves performance**: Fewer component lifecycle operations  
✅ **Maintains reactivity**: Still updates when actual match data changes (new messages, vote locks, etc.)  

## Verification

After this fix, you should see:

1. **Stable chat windows**: No more disappearing/reappearing
2. **Reduced console logs**: Fewer Ably subscription/unsubscription messages
3. **Smooth experience**: Chat remains visible throughout the match

### Console Behavior

**Before (Bad)**:
```
[AblyChannelService] Subscribed ... (total subscribers: 2)
[AblyChannelService] Unsubscribed ... (remaining: 0)  ← Repeated every 5 seconds
[AblyChannelService] Detaching channel ...
```

**After (Good)**:
```
[AblyChannelService] Subscribed ... (total subscribers: 2)
[Ably] Connected for FID 5254
← Stable, no churn
```

## Related Architecture

This fix aligns with the Ably Channel Lifecycle Refactor documented in `docs/ARCHITECTURE.md`:

- **Decoupled Lifecycle**: Channels persist across component remounts
- **Subscriber Tracking**: Service tracks active subscribers to prevent unnecessary detachments
- **Detachment Debounce**: 2-second buffer before detaching unused channels

The memoization fix prevents the component remounting issue that was triggering the detachment/reattachment cycle.
