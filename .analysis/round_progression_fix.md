# Round Progression Fixes

## Issue: Round 2 Stuck
**Symptoms**:
- Game advances from Round 1 to Round 2.
- Matches in Round 2 complete.
- Game gets stuck, does not advance to Round 3.
- Logs show `matchesPlayedThisRound=0` despite matches being finished.

**Root Cause**:
- The logic relied on looking up completed match IDs in `this.state.matches`.
- `cleanupOldMatches` runs every 10s and deletes finished matches from memory.
- When `getActiveMatches` runs after cleanup, it can't find the match objects, so it thinks 0 matches were played.

**Fix**:
1. **New Data Structure**: Added `completedMatchesPerRound` (Map<number, number>) to `PlayerGameSession`.
   - Tracks count of completed matches per round number.
   - Independent of match objects existing in memory.
2. **State Updates**: Updated `GameManager` to increment this counter when a match finishes.
3. **Logic Update**: Updated round progression check to use `completedMatchesPerRound.get(currentRound)` instead of filtering match objects.
4. **Persistence**: Updated `saveSession`/`loadAllSessions` to persist this new field to Redis.

## Status
- ✅ Build passed.
- ✅ Logic is now robust against garbage collection of old matches.
