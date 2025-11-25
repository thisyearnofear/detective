# Detective App - UI/UX Enhancement

## Overview

Transform Detective from "functional but uninspiring" to a polished, immersive experience by borrowing visual patterns and interaction design from the gradientslider carousel.

**Updated Nov 25, 2025**: Roadmap adapted for new multi-chat game architecture.
- Game now features **2 simultaneous 1-minute chats** instead of single 4-minute chat
- Players vote in **real-time** with immediate toggle feedback
- **Desktop shows side-by-side chats**; mobile uses **tabbed interface**
- Vote feedback is now **VoteToggle component** with animated hint and wiggle
- **Emoji picker** provides quick message shortcuts for Farcaster culture
- Inactivity warnings appear at 30s and 45s markers

All changes preserve existing gameplay mechanics and the core mystery element. No admin panel modifications needed.

---

## Core Design Philosophy

- **Maintain mystery**: Never hint whether opponent is real or bot via design
- **Physics-based interactions**: Smooth momentum, friction, easing—nothing feels snappy/cheap
- **Responsive gradients**: Background colors react intelligently to game state
- **Orchestrated animations**: Staggered reveals, timed transitions, purposeful motion
- **Smart loading states**: Transform wait times into immersive, branded experiences
- **Color intelligence**: Extract opponent colors for cohesive visual context
- **Dual-chat optimization**: Make side-by-side and tabbed layouts feel native to their platforms
- **Real-time feedback**: Instant visual response to vote toggles builds confidence

---

## What's Already Implemented ✅

### Phase 1 Components (Nov 25 - Complete)

- ✅ **GradientBackground.tsx**: Canvas-based animated gradient, state-aware colors (REGISTRATION/LIVE/VOTING/FINISHED)
- ✅ **ProgressRingTimer.tsx**: SVG progress ring with color transitions and pulse animations
- ✅ **VoteToggle.tsx**: Enhanced with result feedback (correct/incorrect), lock animation, per-chat independence
- ✅ **ChatWindow.tsx**: Message entrance animations (staggered, 40ms per message), color-themed opponent messages

### Phase 2 Components (Nov 25 - Complete)

- ✅ **OpponentCard.tsx**: Color extraction from pfp, glow effect, animated reveal on new match
- ✅ **RegistrationLoader.tsx**: Step-by-step loading animation (score validation → cast scraping → style extraction → opponents prep)
- ✅ **RoundStartLoader.tsx**: Between-match countdown with "preparing round" phase
- ✅ **MultiChatContainer.tsx**: Color-coded borders (desktop left border, mobile tab indicators) based on vote state
- ✅ **EmojiPicker.tsx**: Farcaster-themed emoji/text shortcuts
- ✅ **GradientBackground.tsx**: Integrated into layout.tsx as fixed background

### Game Architecture (Recent commits)

- ✅ **Multi-chat system** (2 simultaneous 1-minute chats)
- ✅ **Real-time vote toggling** (immediate UI feedback)
- ✅ **Dynamic rounds** based on player pool size
- ✅ **Batch message polling** for performance
- ✅ **Desktop side-by-side layout** (grid-cols-2 on lg screens, color-coded left borders)
- ✅ **Mobile tabbed interface** (color-coded tab indicators)
- ✅ **Dual-chat animations**: All 10 enhancement categories account for parallelism
- ✅ **Color injection**: Opponent colors extracted and applied to cards + message bubbles

---

## Feature Changes & Implementation Plan

### 1. Dynamic Gradient Background System

**Category**: Core Visual Layer  
**Current state**: Static `bg-slate-900` background  
**New approach**: Canvas-based animated gradient that responds to game state

#### Changes:

- Add canvas-based animated gradient background (similar to gradientslider)
- Gradients shift based on game cycle state, not opponent identity
- Two floating radial gradients that drift using trigonometric motion
- Colors transition smoothly when game state changes

#### Color Scheme by Game State:

- **REGISTRATION**: Cool blues/purples (inviting, calm)
- **LIVE - Dual chats**: Warm amber/coral (engagement, dual energy)
- **Between rounds**: Teal/emerald (reset, decision clarity)
- **Game over**: Gold/bronze (celebration, achievement)

#### Game-Specific Impact:

- In dual-chat mode, gradient intensity could pulse when one chat needs attention
- Color could shift when approaching 30s warning or 45s critical markers
- Separate color layers for each chat slot (desktop) could enhance focus

#### Performance Impact:

- Canvas rendering is GPU-accelerated
- 30fps idle saves battery on mobile
- No layout thrashing (pure canvas + transform rendering)

#### UX Benefit:

Players feel immersed in an intentional experience. Dual-chat pace (1 minute × 2) demands visual clarity—gradients create emotional context without explicit direction.

---

### 2. Opponent Card Reveal Animation

**Category**: Match Initialization  
**Current state**: Opponent displays with no entrance animation  
**New approach**: 3D perspective reveal with glow effect

#### Changes:

- When opponent loads, card animates in from off-screen with 3D perspective
- Card starts at 0.7x scale + -40px translateY + opacity 0
- Scales up, slides down, fades in over 0.6s with cubic-bezier easing
- Background gradient pulses subtly as card completes reveal
- Opponent's profile picture gets subtle frame/glow effect from extracted colors

#### Implementation Details:

- Extract 2 dominant colors from opponent's pfp using histogram analysis
- Use extracted colors to tint the frame border (subtle, not obvious)
- Animate border opacity and glow intensity during reveal
- Works the same for real users and bots (no tells)

#### Dual-Chat Impact:

- Each opponent card reveal happens simultaneously in desktop view
- Mobile: opponent card animates in when user switches tabs to new chat
- Could add a small "Chat 1" / "Chat 2" badge with entrance

#### Performance Impact:

- GSAP animation (single timeline, 1 element per opponent)
- GPU-accelerated transform
- ~1ms per frame, negligible

#### UX Benefit:

First interaction with each opponent feels designed and special. Sets expectation that this is a polished app. The glow creates visual focus without explaining *why* the opponent is important.

---

### 3. Chat Message Entrance Animations

**Category**: Message Flow  
**Current state**: Messages appear instantly  
**New approach**: Staggered entrance with subtle bounce

#### Changes:

- Messages slide in from left (opponent) or right (player) with opacity fade
- Use momentum-based animation (slight bounce on arrival)
- Opponent messages get subtle delay (simulating typing, though they're instant)
- Messages don't pile up instantly—stagger by 40ms for visual rhythm
- Scrolling to newest message is smooth, not jarring

#### Implementation Details:

```
- Incoming message: scale 0.95 → 1, opacity 0 → 1, duration 0.3s
- Add 50ms delay before animating (simulates "opponent thinking")
- Use ease-out cubic for natural deceleration
- Bots still respond instantly from API, but animation hides the perfection
```

#### Dual-Chat Impact:

- In desktop view, messages from both chats animate simultaneously
- Creates sense of parallel conversations happening in real-time
- Mobile: only visible chat's messages animate (no distraction from hidden tab)

#### Performance Impact:

- Staggered animations prevent layout thrashing
- `will-change: transform` on message containers
- ~0.5ms per message, smooth on mobile

#### UX Benefit:

Conversations feel more natural. Bot responses don't *feel* instant (which would be a tell). Animation delay gives players time to read each message. Fast dual-chat pacing demands this visual clarity.

---

### 4. VoteToggle Enhancement (Partially Implemented ✅)

**Category**: Voting UX  
**Current state**: VoteToggle component exists with animated hint  
**Enhancement**: Add state transition animations and visual feedback

#### Already Shipped:

- ✅ Defaults to HUMAN (optimistic assumption)
- ✅ Animated hint in first 5 seconds (wiggle left/right)
- ✅ Locked state indicator with 🔒
- ✅ Responsive sizing (compact mode for side-by-side)

#### Remaining Enhancements:

- Add vote result feedback animation when vote finalizes
  - Correct: subtle scale-up + glow pulse for 1.5s
  - Incorrect: subtle shake + color shift for 1.5s
- Add visual connection to vote state per chat
  - Desktop: color-coded borders on chat windows (green=voting HUMAN, red=voting BOT)
  - Mobile: color-coded tab indicator
- Add "vote locked" animation when timer expires
  - Scale animation + lock icon appearance
  - Disable toggle button with opacity transition
  - Reset animation hints for next chat

#### Implementation Details:

```jsx
// When vote locks (timer = 0):
- Scale VoteToggle to 0.95 → 1 over 0.3s
- Add padlock icon with fade-in
- Disable toggle button with opacity transition
- Reset animation hints for next chat
```

#### Dual-Chat Impact:

- Each chat has independent VoteToggle state
- Desktop: both toggles visible simultaneously, no confusion
- Mobile: toggle state persists even when switching tabs (user sees previous state)
- Visual feedback when votes are locked in both chats

#### Performance Impact:

- CSS animations only (no JavaScript)
- GPU-accelerated transforms
- Minimal impact

---

## Game Flow Implementation: No Mid-Game Results (Nov 25, 2025)

### Overview

Refactored game flow to show aggregate results only at game end, not after individual matches. This prevents psychological dropoff ("I already lost") and encourages completion of all 5 rounds.

**Key principle**: Auto-lock votes on server; show opponent reveal briefly; display final results only after all matches complete.

### Architecture Changes

#### 1. Server-Side Vote Auto-Lock

**File**: `src/lib/gameState.ts` (lines 165-187)

When `getActiveMatches()` detects an expired unvoted match, it automatically locks the vote. Backend is now the source of truth.

```typescript
if (match.endTime <= now && !match.voteLocked) {
  // Auto-lock vote when time expires
  this.lockMatchVote(matchId);
}
```

**Why**: Removes race conditions between client timer and server cleanup.

#### 2. Idempotent Vote Lock Endpoint

**File**: `src/app/api/match/vote/route.ts` (PUT handler)

The PUT endpoint now confirms an already-locked vote instead of locking it. Safe to call multiple times.

```typescript
if (match.voteLocked) {
  // Already locked, return the result
  return NextResponse.json({ success: true, isCorrect, ... });
}
```

#### 3. Enhanced ResultsCard Component

**File**: `src/components/ResultsCard.tsx`

Multi-mode component handling 3 display types:

- **`opponent-reveal`** - Shows opponent identity for 2 seconds (no correctness shown)
- **`round-summary`** - Round accuracy (unused currently, available for future)
- **`game-complete`** - Full game results with accuracy, rank, round breakdown

Each mode has dedicated UI section with smooth transitions.

#### 4. Enhanced Leaderboard Component  

**File**: `src/components/Leaderboard.tsx`

Dual-mode component with tab switcher:

- **`current`** - Current game leaderboard (existing functionality)
- **`career`** - Career stats dashboard showing:
  - Total games, overall accuracy, best/worst game, avg decision speed
  - Game history with per-game rank & accuracy
  - Dynamic insights based on playstyle

#### 5. Career Stats API Endpoint

**File**: `src/app/api/stats/career/route.ts`

Returns aggregated stats from player's vote history:
- Groups votes into 5-vote games
- Calculates accuracy per game
- Returns leaderboard history
- Generates insights (quick/careful decision maker, etc)

#### 6. Updated MultiChatContainer

**File**: `src/components/MultiChatContainer.tsx`

- Detects when all rounds are complete
- Shows ResultsCard in `game-complete` mode
- Tracks round results (opponent username, type, correctness)
- Shows opponent reveal after each vote lock (2 seconds)
- Resets for "Play Again"

### Game Flow

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

### Component Architecture

#### Before (Bloated)
```
MultiChatContainer
├─ OpponentRevealCard
├─ EndGameResultsScreen
└─ Leaderboard
   ├─ CareerStatsPage (via separate route)
```

#### After (Consolidated)
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

### Key Design Decisions

#### No Mid-Game Results

**Decision**: Show opponent reveal, not correctness, between matches.

**Why**: 
- Players who lose early rounds don't abandon
- Momentum carries through all 5 rounds
- Results feel more significant when aggregated

#### Server Auto-Locks Votes

**Decision**: Backend locks votes when endTime passes, not relying on client timer.

**Why**:
- Single source of truth eliminates race conditions
- Frontend timer becomes confirmation, not mechanism
- Simpler state management

#### Career Stats in Leaderboard

**Decision**: Add career mode to existing Leaderboard instead of separate page.

**Why**:
- No page navigation required
- Users can toggle between current/career on same page
- Consistent theming and styling
- Single component to maintain

### API Endpoints Reference

#### Vote Management
- `POST /api/match/vote` - Update vote during match
- `PUT /api/match/vote` - Confirm vote lock at match end

#### Game Status
- `GET /api/match/active?fid={fid}` - Get active matches, includes playerRank

#### Stats
- `GET /api/stats/career?fid={fid}` - Get career statistics

#### Leaderboard
- `GET /api/leaderboard/current` - Get current game rankings