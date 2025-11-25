# Opponent Reveal Flow Redesign

## Problem → Solution

### What Changed
**Old Flow (Poor UX):**
- Sequential reveals: Match 1 completes → 2s reveal → Match 2 completes → 2s reveal → jarring blank loading screen
- Players barely process "was it a bot?" before modal vanishes
- No context during loading, just a spinner
- Rushed transition (4s total reveals + loading = disconnected experience)

**New Flow (Unified Experience):**
- Batch reveals: All round matches complete → unified reveal screen with both opponents + stats
- 6 second display minimum (easily adjustable to 5-8s)
- Shows real-time progress: accuracy, rank, matches this round, next round countdown
- Smooth fade into loading state (RoundStartLoader) instead of jarring blank screen
- Single modal handles reveal + stats + context + auto-dismiss

---

## Architecture Changes

### 1. RoundTransition Component (Enhanced)
**Location:** `src/components/RoundTransition.tsx`

**New Capabilities:**
- Two phases: `reveal` | `loading`
- `reveal` phase: 
  - Display 1-2 opponent cards side-by-side
  - Inject stats panel (accuracy, rank, matches this round, next round info)
  - Auto-dismiss countdown bar (6 seconds default, configurable)
  - Staggered card animations (100ms delay between reveals)
- `loading` phase:
  - Show round preparation spinner while next matches load
  - Provide context ("Preparing Round N")

**Props:**
```typescript
{
  isVisible: boolean;
  phase?: "reveal" | "loading";
  reveals?: RevealData[]; // Multiple reveals for batch display
  stats?: { accuracy, correct, total, playerRank, totalPlayers };
  nextRoundNumber?: number;
  displayDuration?: number; // 5-8s recommended
  onComplete?: () => void;
}
```

### 2. MultiChatContainer (Refactored)
**Location:** `src/components/MultiChatContainer.tsx`

**Removed:**
- Sequential `revealQueue` + `revealingMatch` logic (AGGRESSIVE CONSOLIDATION)
- `OpponentRevealCard` import and usage
- Auto-dismiss timeout for each reveal

**Added:**
- `batchReveals` state: collects all reveals from round
- `showRevealScreen` state: triggers unified reveal modal
- Logic to show reveals when: round ends + matches locked + no new matches available
- Passes stats + reveals + next round info to RoundTransition

**Flow:**
```
User votes → Match locked → handleMatchComplete() 
  → collect reveal data in batchReveals[]
  → When round ends (no more matches):
    → setShowRevealScreen(true)
    → RoundTransition displays all reveals + stats
    → After 6s: auto-dismiss → RoundStartLoader
```

### 3. Deleted Components
- **OpponentRevealCard.tsx** - functionality consolidated into RoundTransition
  - This eliminates 111 lines of duplicate reveal logic
  - Single source of truth now (CLEAN, DRY principles)

---

## User Experience Flow

```
[Game Active]
  ↓
[Both Matches Complete]
  → Vote locked on both matches
  ↓
[RoundTransition - REVEAL PHASE] (6 seconds)
  ┌─────────────────────────────────────┐
  │     Round Complete                  │
  │   Opponents Revealed                │
  ├────────────────────────────────────┤
  │  [Avatar] Bot  │  [Avatar] Human   │
  │   @user123     │    @user456       │
  │  AI Bot        │  Farcaster User   │
  ├────────────────────────────────────┤
  │ 75% Accuracy  │ #5 Rank  │ 2 Matches│
  │ 3/4 correct   │ of 250   │ this round
  │               Next Round: 2         │
  ├────────────────────────────────────┤
  │ ====== Progress Bar ====== (5.8s)   │
  │ Proceeding to next round in 5.8s    │
  └─────────────────────────────────────┘
  ↓
[RoundTransition - LOADING PHASE]
  ┌─────────────────────────────────────┐
  │      ⟳ (spinner)                    │
  │  Preparing Round 2                  │
  │  Finding opponents...               │
  └─────────────────────────────────────┘
  ↓
[Next Round Matches Loaded]
  → RoundTransition auto-closes
  → Back to chat screens
```

---

## Why This Design Aligns with Core Principles

### ENHANCEMENT FIRST
- Enhanced existing RoundTransition component instead of creating new modal
- Reused animations (animate-scale-in, animate-fade-in) already in Tailwind

### AGGRESSIVE CONSOLIDATION
- Deleted OpponentRevealCard (111 lines of duplicate reveal UI)
- Deleted sequential reveal queue system
- Single source of truth for reveal UI (RoundTransition)

### DRY
- Reveal logic centralized in one component
- Stats calculation in one place (handleMatchComplete → batchReveals)
- No duplicated countdown timers or modal overlays

### CLEAN
- Clear separation: 
  - MultiChatContainer handles game state & vote completion
  - RoundTransition handles reveal UI & transitions
  - Stats injection at RoundTransition call site
- Explicit dependencies (props passed directly)

### MODULAR
- RoundTransition works independently (can test reveal/loading phases separately)
- Batch reveals decoupled from sequential processing
- Each phase (reveal → loading) is independent

### PERFORMANT
- No polling or extra network calls during reveal
- Countdown uses setInterval (same as before, not worse)
- Portal rendering (createPortal) prevents layout thrashing
- Reveal queue replaced with batch array (simpler memory footprint)

### ORGANIZED
- Components in `/components/` directory
- Clear file structure: Container → display components
- Type definitions co-located with component

---

## Configuration Options

### Reveal Display Duration
Default: **6000ms** (6 seconds)

Adjust in MultiChatContainer:
```typescript
displayDuration={7000} // for 7 second reveal
displayDuration={5000} // for 5 second reveal
```

### Card Animation Delay
Default: **100ms stagger** between cards

Adjust in RoundTransition:
```typescript
style={{ animationDelay: `${idx * 150}ms` }} // 150ms stagger
```

---

## Testing Checklist

- [ ] Complete 1 match: reveal shows 1 opponent card
- [ ] Complete 2 matches: reveal shows 2 opponent cards side-by-side
- [ ] Countdown timer displays correctly (6s → 0s)
- [ ] Stats panel shows accurate accuracy/rank/matches
- [ ] Auto-dismiss after countdown completes
- [ ] Smooth fade into RoundStartLoader
- [ ] Loading spinner shows "Preparing Round N"
- [ ] Next round loads normally after reveal

---

## Future Enhancements

1. **Reveal History Tab** - Show all past reveals in Leaderboard career view
2. **Quick Replay** - Click opponent to see their message again
3. **Sound Effects** - Ding on reveal, gentle transition sound
4. **Confetti Animation** - On high accuracy rounds (e.g., 2/2 correct)
5. **Round Summary Stats** - Best guesses, hardest opponent, streaks

---

## Git Cleanup

Deleted files (safely removed, no other references):
- `src/components/OpponentRevealCard.tsx`

Modified files:
- `src/components/RoundTransition.tsx` (120 → 193 lines, enhanced)
- `src/components/MultiChatContainer.tsx` (610 → 617 lines, refactored)

Removed dependencies:
- OpponentRevealCard import (no longer needed)
- Sequential reveal queue logic (centralized in batch system)
