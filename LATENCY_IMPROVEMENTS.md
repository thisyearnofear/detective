# Bot Response Latency & UX Improvements

## Summary
Implemented 5 major optimizations to reduce bot response latency and improve the game-over UX with clear next-step guidance.

---

## 1. Ably Connection Optimization

### Changes to `src/lib/ablyChannelService.ts`
- **Aggressive reconnection timeouts** for real-time games:
  - `reconnectTimeout`: 15s → 5s
  - `realtimeRequestTimeout`: 20s → 10s  
  - `disconnectedRetryTimeout`: 3s → 1s
  - `suspendedRetryTimeout`: 10s → 5s
  - `httpOpenTimeout`: 10s → 5s

- **Increased idle timeout** to prevent unnecessary disconnects:
  - `maxIdleInterval`: 60s → 120s (prevents 30s idle timeout issue from console logs)

- **Faster channel operations**:
  - `ATTACH_TIMEOUT_MS`: 10s → 5s
  - `DETACH_DEBOUNCE_MS`: 2s → 1s

**Expected Impact**: 5-10s faster recovery from connection failures; eliminates 30-second idle disconnections.

---

## 2. Bot Response Delivery Speed

### Changes to `src/lib/botResponseDelivery.ts`

#### Polling Interval
- Reduced from 100ms to **50ms** for faster response detection
- Batches multiple ready responses and delivers them in **parallel** instead of sequentially

#### Direct REST API Publishing
- Changed from channel publishing (async) to **Ably REST API** (synchronous)
- Fire-and-forget model: marks delivery immediately after REST publish, doesn't wait for confirmation
- Uses fixed message IDs for idempotency: `${matchId}-${botFid}-${timestamp}`

#### Code Changes
```typescript
// OLD: Await channel publish
await ablyManager.publishToMatchChannel(matchId, chatMessage);

// NEW: Fire REST API directly, non-blocking
const restClient = getRestClient();
const channel = restClient.channels.get(`match:${matchId}`);
channel.publish("message", chatMessage).catch(err => {
  console.error(`Failed to publish to REST channel: ${err.message}`);
});
```

**Expected Impact**: 100-150ms faster message delivery; supports parallel delivery of multiple responses.

---

## 3. Connection Prewarming

### New file: `src/lib/connectionPrewarm.ts`

Establishes Ably connection **before** a match starts, eliminating cold-start latency.

```typescript
// Usage in game initialization:
await prewarmAblyConnection(playerFid);
```

**Where it's called**: 
- `src/components/game/GameLobby.tsx` in `handleGameStart()` 
- Prewarmed for all registered players as they prepare to play

**Expected Impact**: 500-1000ms latency reduction for first message in a match.

---

## 4. Improved Game-Over UX

### Changes to `src/components/game/GameFinishedView.tsx`

#### New Features Added
1. **"Share Results" button** - Links to Warpcast for social sharing
2. **"View Stats" button** - Navigate to detailed player stats (TODO: routing)
3. **Auto-join notification** - Clearly states "You'll automatically join the next game"
4. **Real player stats display** - Fetches and shows:
   - Total games played
   - Overall accuracy %
   - Average response speed (ms)
5. **Better visual hierarchy**:
   - Green accent for countdown timer
   - Section labels for clarity
   - Player count display during countdown

#### Data Flow
- Fetches player stats via `/api/stats/player/{fid}` endpoint
- Uses SWR for client-side caching
- Falls back to zeros while loading

---

## 5. Updated Component Props

### `GameStateView.tsx`
- Now passes `fid` to `GameFinishedView` for stats fetching

### `GameFinishedView.tsx`
- Added `fid?: number` prop
- Added SWR hook for stats fetching
- Updated UI with sections, buttons, and real data

---

## Latency Impact Summary

| Optimization | Impact | Latency Reduction |
|---|---|---|
| Polling 100ms → 50ms | Detect responses faster | ~50ms |
| REST API direct publish | Skip channel overhead | ~100-150ms |
| Aggressive reconnects | Faster failure recovery | ~5-10s on disconnects |
| Connection prewarming | Eliminate cold-start | ~500-1000ms |
| Batch parallel delivery | Process multiple responses | Scales with batch size |

**Total Expected Improvement: 200-300ms faster bot responses** (under normal conditions)

---

## Testing Checklist

- [ ] Bot responses appear faster in practice
- [ ] No duplicate messages (fixed ID prevents this)
- [ ] Ably connection stays stable (2min idle timeout)
- [ ] Game-over screen displays correctly
- [ ] Player stats load and display properly
- [ ] Share button links to Warpcast
- [ ] Auto-join countdown updates correctly
- [ ] Connection prewarming doesn't block game transitions

---

## Future Optimizations

1. **Server-sent events** - Replace polling entirely with SSE for instant delivery
2. **Message queuing** - Use Ably presence for better sync
3. **Connection pooling** - Reuse connections across multiple tabs
4. **Stats caching** - Cache player stats in localStorage to avoid delay on load
5. **Share integration** - Generate custom share text with game results
