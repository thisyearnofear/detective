# Game Flow Update: No Mid-Game Results (Nov 25, 2025)

## Overview
Updated the game flow to show aggregate results only at the end of each game cycle, not after individual matches. This prevents psychological dropoff ("I already lost") and encourages players to complete all rounds.

## Architecture Changes

### 1. **Auto-locking Votes on Server**
- **File**: `src/lib/gameState.ts` (lines 165-187)
- When `getActiveMatches()` is called and detects an expired match with an unlocked vote, it automatically locks the vote
- **Why**: Removes race condition between frontend timer and backend cleanup
- **Behavior**: Backend is now the source of truth for vote locking

### 2. **Idempotent Vote Lock Endpoint**
- **File**: `src/app/api/match/vote/route.ts` (PUT handler)
- The PUT endpoint now just confirms/refreshes an already-locked vote instead of trying to lock it
- Returns success even if vote was already locked by auto-lock
- **Why**: Frontend timer expiration is now just a confirmation, not the primary locking mechanism

### 3. **Opponent Reveal (No Results)**
- **New Component**: `src/components/OpponentRevealCard.tsx`
- Shows opponent identity and whether they were real/bot after vote locks
- Appears for 2 seconds then disappears
- **Why**: Provides closure to match without showing if guess was correct

### 4. **End-Game Results Screen**
- **New Component**: `src/components/EndGameResultsScreen.tsx`
- Shows after all 5 matches are complete:
  - Accuracy % (circular progress indicator)
  - Correct count / total
  - Leaderboard rank & percentile
  - Round-by-round breakdown with ✅/❌
  - Performance message ("Outstanding!", "Great job!", etc)
- **Why**: Celebrates accomplishment after completing all rounds

### 5. **Career Stats Page**
- **New Component**: `src/components/CareerStatsPage.tsx`
- **New Route**: `src/app/stats`
- Persistent stats dashboard showing:
  - Total games played
  - Overall accuracy across all games
  - Best/worst game accuracy
  - Average decision speed
  - Game history with rankings
- **Why**: Long-term engagement lever - encourages return plays to improve career stats

### 6. **Career Stats API**
- **New Endpoint**: `src/app/api/stats/career/route.ts`
- Returns aggregated stats for a player
- Currently backed by in-memory state; ready for database integration
- Tracks:
  - Vote history accuracy
  - Speed metrics
  - Game-by-game leaderboard position

## Game Flow Diagram

```
User enters game
    ↓
Registration phase
    ↓
LIVE phase begins
    ↓
Round 1-5 Match
├─ Chat window (1 minute)
├─ Vote before timer expires
├─ Timer expires → vote auto-locks on server
├─ Client confirms lock (PUT)
├─ Opponent reveal card appears (2s)
├─ Opponent card disappears
└─ Next round begins or game ends
    ↓
(Repeat for 5 rounds)
    ↓
All matches complete
    ↓
END GAME RESULTS SCREEN
├─ Accuracy percentage
├─ Leaderboard rank
├─ Round-by-round breakdown
├─ "Play Again" button
└─ "View Career Stats" button
    ↓
[Player chooses: Play Again or View Career Stats]
```

## Key Design Decisions

### Why No Mid-Game Results?
1. **Psychological Safety**: Players who get early rounds wrong won't abandon
2. **Engagement Continuation**: Momentum carries through all 5 rounds
3. **Better UX**: Results feel more significant when aggregated

### Why Auto-Lock Votes?
1. **Removes Race Conditions**: No timing issues between client timer and server cleanup
2. **Single Source of Truth**: Backend drives game state, not frontend
3. **Cleaner Architecture**: Simplifies state management

### Why Career Stats?
1. **Long-term Engagement**: Seasons/cycles with persistent rankings motivate return plays
2. **Learning Loop**: Players analyze past games to improve
3. **Social Element**: Career stats enable "climb the ranks" narrative

## Implementation Checklist

- [x] Auto-lock votes on server when time expires
- [x] Make vote lock endpoint idempotent
- [x] Create OpponentRevealCard component
- [x] Create EndGameResultsScreen component
- [x] Create CareerStatsPage component
- [x] Add /stats route
- [x] Create career stats API endpoint
- [x] Update MultiChatContainer to detect game completion
- [x] Wire opponent reveals and end-game screen
- [x] Add leaderboard rank to match/active endpoint
- [x] TypeScript compilation passes
- [ ] Test full game flow end-to-end
- [ ] Test stats persistence (currently in-memory)
- [ ] Deploy to staging

## Future Improvements

1. **Database Integration**: Persist game results and stats to database for retention across server resets
2. **Seasonal Leaderboards**: Reset rankings periodically (weekly/monthly) to encourage return plays
3. **Insights Dashboard**: More detailed analytics (best vs worst opponent types, improving accuracy trend)
4. **Notifications**: Notify players when they break personal records or move up leaderboard
5. **Social Sharing**: Share results ("I got 80% accuracy! Can you beat that?")
6. **Replay Analysis**: Let players review opponent reveals and messages they sent
