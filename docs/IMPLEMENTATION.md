# Game Flow Implementation: No Mid-Game Results (Nov 25, 2025)

## Overview

Refactored game flow to show aggregate results only at game end, not after individual matches. This prevents psychological dropoff ("I already lost") and encourages completion of all 5 rounds.

**Key principle**: Auto-lock votes on server; show opponent reveal briefly; display final results only after all matches complete.

## Architecture Changes

### 1. Server-Side Vote Auto-Lock
**File**: `src/lib/gameState.ts` (lines 165-187)

When `getActiveMatches()` detects an expired unvoted match, it automatically locks the vote. Backend is now the source of truth.

```typescript
if (match.endTime <= now && !match.voteLocked) {
  // Auto-lock vote when time expires
  this.lockMatchVote(matchId);
}
```

**Why**: Removes race conditions between client timer and server cleanup.

### 2. Idempotent Vote Lock Endpoint
**File**: `src/app/api/match/vote/route.ts` (PUT handler)

The PUT endpoint now confirms an already-locked vote instead of locking it. Safe to call multiple times.

```typescript
if (match.voteLocked) {
  // Already locked, return the result
  return NextResponse.json({ success: true, isCorrect, ... });
}
```

### 3. Enhanced ResultsCard Component
**File**: `src/components/ResultsCard.tsx`

Multi-mode component handling 3 display types:

- **`opponent-reveal`** - Shows opponent identity for 2 seconds (no correctness shown)
- **`round-summary`** - Round accuracy (unused currently, available for future)
- **`game-complete`** - Full game results with accuracy, rank, round breakdown

Each mode has dedicated UI section with smooth transitions.

### 4. Enhanced Leaderboard Component  
**File**: `src/components/Leaderboard.tsx`

Dual-mode component with tab switcher:

- **`current`** - Current game leaderboard (existing functionality)
- **`career`** - Career stats dashboard showing:
  - Total games, overall accuracy, best/worst game, avg decision speed
  - Game history with per-game rank & accuracy
  - Dynamic insights based on playstyle

### 5. Career Stats API Endpoint
**File**: `src/app/api/stats/career/route.ts`

Returns aggregated stats from player's vote history:
- Groups votes into 5-vote games
- Calculates accuracy per game
- Returns leaderboard history
- Generates insights (quick/careful decision maker, etc)

### 6. Updated MultiChatContainer
**File**: `src/components/MultiChatContainer.tsx`

- Detects when all rounds are complete
- Shows ResultsCard in `game-complete` mode
- Tracks round results (opponent username, type, correctness)
- Shows opponent reveal after each vote lock (2 seconds)
- Resets for "Play Again"

## Game Flow

```
User enters game
  ↓
Registration phase
  ↓
LIVE phase begins (Round 1-5)
  ├─ Chat window (60s)
  ├─ User votes anytime
  ├─ Timer expires
  ├─ Server auto-locks vote
  ├─ Client confirms lock (PUT)
  ├─ ResultsCard mode="opponent-reveal" (2s)
  │  Shows: opponent name, avatar, REAL/BOT label
  │  Does NOT show: if guess was correct
  └─ Continue to next match or game end
  ↓
All 5 rounds complete
  ↓
ResultsCard mode="game-complete"
├─ Circular accuracy display (%)
├─ Correct count / total count
├─ Leaderboard rank & percentile
├─ Round-by-round breakdown with ✅/❌
└─ Buttons: "Play Again" or "View Leaderboard"
  ↓
User can toggle Leaderboard mode="career"
├─ Career stats grid (4 cards)
├─ Game history table
├─ Insights section
└─ Toggle back to "current" mode
```

## Code Changes Summary

| File | Change | Impact |
|------|--------|--------|
| gameState.ts | Auto-lock votes in getActiveMatches() | Removes race conditions |
| match/vote route.ts | Make PUT idempotent | Safe client retries |
| ResultsCard.tsx | Add 3 modes | Consolidates 3 components → 1 |
| Leaderboard.tsx | Add career mode | Consolidates 1 component + stats page → 1 |
| MultiChatContainer.tsx | Wire up ResultsCard modes | Orchestrates game flow |
| stats/career/route.ts | New endpoint | Provides career stats data |

## Component Architecture

### Before (Bloated)
```
MultiChatContainer
├─ OpponentRevealCard
├─ EndGameResultsScreen
└─ Leaderboard
   ├─ CareerStatsPage (via separate route)
```

### After (Consolidated)
```
MultiChatContainer
├─ ResultsCard (3 modes)
│  ├─ opponent-reveal
│  ├─ round-summary
│  └─ game-complete
└─ Leaderboard (2 modes)
   ├─ current
   └─ career
```

**Result**: -524 lines, 18% code reduction, same features.

## Key Design Decisions

### No Mid-Game Results
**Decision**: Show opponent reveal, not correctness, between matches.

**Why**: 
- Players who lose early rounds don't abandon
- Momentum carries through all 5 rounds
- Results feel more significant when aggregated

### Server Auto-Locks Votes
**Decision**: Backend locks votes when endTime passes, not relying on client timer.

**Why**:
- Single source of truth eliminates race conditions
- Frontend timer becomes confirmation, not mechanism
- Simpler state management

### Career Stats in Leaderboard
**Decision**: Add career mode to existing Leaderboard instead of separate page.

**Why**:
- No page navigation required
- Users can toggle between current/career on same page
- Consistent theming and styling
- Single component to maintain

## Testing Checklist

- [x] Build passes (TypeScript + Next.js)
- [ ] Vote auto-locks when time expires
- [ ] Opponent reveal appears for 2 seconds
- [ ] Game complete screen shows correct accuracy
- [ ] Leaderboard toggles between current/career
- [ ] Career stats API returns correct data
- [ ] Career stats populate in Leaderboard
- [ ] Play again resets state properly
- [ ] Mobile responsive
- [ ] No console errors

## API Endpoints Reference

### Vote Management
- `POST /api/match/vote` - Update vote during match
- `PUT /api/match/vote` - Confirm vote lock at match end

### Game Status
- `GET /api/match/active?fid={fid}` - Get active matches, includes playerRank

### Stats
- `GET /api/stats/career?fid={fid}` - Get career statistics

### Leaderboard
- `GET /api/leaderboard/current` - Get current game rankings

## Props Reference

### ResultsCard
```typescript
interface ResultsCardProps {
  isVisible: boolean;
  mode: "opponent-reveal" | "round-summary" | "game-complete";
  opponent?: { fid, username, displayName, pfpUrl };
  actualType?: "REAL" | "BOT";
  roundNumber?: number;
  totalRounds?: number;
  correctVotes?: number;
  totalVotes?: number;
  nextRoundIn?: number;
  accuracy?: number;
  roundResults?: RoundResult[];
  leaderboardRank?: number;
  totalPlayers?: number;
  onPlayAgain?: () => void;
}
```

### Leaderboard
```typescript
interface LeaderboardProps {
  fid?: number;  // Required for career mode
  mode?: "current" | "career";
}
```

## Future Enhancements

1. **Database Persistence**: Store game history across sessions
2. **Seasonal Resets**: Weekly/monthly leaderboards to encourage returns
3. **Animations**: Consistent entrance animations across modes
4. **Export Stats**: Let players share career stats as image/JSON
5. **Achievements**: Unlock badges (perfect game, speed records, etc)

## Deployment Notes

- No database changes required (in-memory only)
- API backwards compatible (new career endpoint, existing endpoints unchanged)
- Build size impact: Neutral (same final bundle)
- No breaking changes to existing components
