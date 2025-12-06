# Detective Game Design & UI/UX

## Game Design Overview

Detective is a social deduction game where players chat with opponents and try to determine if they're talking to a real person or an AI bot trained on that person's writing style.

### Core Design Philosophy
- **Maintain mystery**: Never hint whether opponent is real or bot via design
- **Physics-based interactions**: Smooth momentum, friction, easing—nothing feels snappy/cheap
- **Responsive gradients**: Background colors react intelligently to game state
- **Orchestrated animations**: Staggered reveals, timed transitions, purposeful motion
- **Smart loading states**: Transform wait times into immersive, branded experiences
- **Color intelligence**: Extract opponent colors for cohesive visual context
- **Real-time feedback**: Instant visual response to vote toggles builds confidence

---

## Game Flow & Mechanics

### Registration Flow with Blockchain Integration
Instead of time-based registration, use **player-count-based triggers**:
```
Game starts when:
- Minimum 10 players registered, OR
- Maximum 50 players registered (auto-start), OR
- 5 minutes since first registration (if >= 6 players)
```

### Registration Interface
```
┌─────────────────────────────────────────────────────────────┐
│                    DETECTIVE                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Choose Your Arena                                   │   │
│  │                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐              │   │
│  │  │  ARBITRUM    │    │    MONAD     │              │   │
│  │  │  ⚡ Fast     │    │  🚀 Blazing  │              │   │
│  │  │  3/10 players│    │  7/10 players│              │   │
│  │  │              │    │              │              │   │
│  │  │ Entry: 0.001 │    │ Entry: Free* │              │   │
│  │  │     ETH      │    │  (NFT req)   │              │   │
│  │  └──────────────┘    └──────────────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  * Requires Detective Pass NFT                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Waiting Room                                        │   │
│  │                                                      │   │
│  │  ████████░░░░░░░░░░░░░░  7/10 players                 │   │
│  │                                                      │   │
│  │  @alice  @bob  @charlie  @dave  @eve  @frank  @grace│   │
│  │                                                      │   │
│  │  Game starts automatically when 10 players join     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Entry Methods

#### Option A: Paid Entry (Arbitrum)
```typescript
const ENTRY_FEE = ethers.parseEther("0.001"); // ~$3-4

async function registerWithPayment(fid: number, chain: 'arbitrum') {
  const signer = await provider.getSigner();
  const tx = await detectiveContract.register(fid, {
    value: ENTRY_FEE
  });
  await tx.wait();
  
  await fetch('/api/game/register', {
    method: 'POST',
    body: JSON.stringify({ fid, chain, txHash: tx.hash })
  });
}
```

#### Option B: NFT Gating (Monad)
```typescript
async function registerWithNFT(fid: number, chain: 'monad') {
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  const balance = await detectivePassNFT.balanceOf(address);
  if (balance === 0n) {
    throw new Error("Detective Pass NFT required");
  }
  
  const message = `Register for Detective Game\nFID: ${fid}\nTimestamp: ${Date.now()}`;
  const signature = await signer.signMessage(message);
  
  await fetch('/api/game/register', {
    method: 'POST',
    body: JSON.stringify({ fid, chain, signature, address })
  });
}
```

---

## UI/UX Enhancement

### What Makes Us Different - Feature Showcase

```
┌─────────────────────────────────────────┐
│         What Makes Us Different         │
├─────────────────────────────────────────┤
│ 📊 4 Leaderboard Modes                  │
│ Current • Career • Insights • Multi-...  │
├─────────────────────────────────────────┤
│ 🌐 Multi-Chain Support                  │
│ Arbitrum • Monad • Cross-Chain           │
├─────────────────────────────────────────┤
│ ⚡ Real-Time Analytics                  │
│ Competitive insights • Trend analysis    │
├─────────────────────────────────────────┤
│ 🤖 AI Opponents                         │
│ Personalized • Adaptive • Fair           │
└─────────────────────────────────────────┘
```

### Dynamic Gradient Background System
**Core Visual Layer** - Canvas-based animated gradient that responds to game state

**Color Scheme by Game State**:
- **REGISTRATION**: Cool blues/purples (inviting, calm)
- **LIVE - Dual chats**: Warm amber/coral (engagement, dual energy)
- **Between rounds**: Teal/emerald (reset, decision clarity)
- **Game over**: Gold/bronze (celebration, achievement)

**Implementation**:
- Two floating radial gradients that drift using trigonometric motion
- Colors transition smoothly when game state changes
- Canvas rendering is GPU-accelerated (30fps idle, saves battery)
- No layout thrashing (pure canvas + transform rendering)

### Opponent Card Reveal Animation
**Match Initialization** - 3D perspective reveal with glow effect

**Changes**:
- When opponent loads, card animates in from off-screen with 3D perspective
- Card starts at 0.7x scale + -40px translateY + opacity 0
- Scales up, slides down, fades in over 0.6s with cubic-bezier easing
- Background gradient pulses subtly as card completes reveal
- Extract 2 dominant colors from opponent's pfp using histogram analysis
- Use extracted colors to tint the frame border (subtle, not obvious)

**Performance Impact**:
- GSAP animation (single timeline, 1 element per opponent)
- GPU-accelerated transform
- ~1ms per frame, negligible

### Chat Message Entrance Animations
**Message Flow** - Staggered entrance with subtle bounce

**Implementation**:
```typescript
// Incoming message: scale 0.95 → 1, opacity 0 → 1, duration 0.3s
// Add 50ms delay before animating (simulates "opponent thinking")
// Use ease-out cubic for natural deceleration
// Bots still respond instantly from API, but animation hides the perfection
```

**Dual-Chat Impact**:
- In desktop view, messages from both chats animate simultaneously
- Creates sense of parallel conversations happening in real-time
- Mobile: only visible chat's messages animate (no distraction from hidden tab)

**Performance Impact**:
- Staggered animations prevent layout thrashing
- `will-change: transform` on message containers
- ~0.5ms per message, smooth on mobile

### VoteToggle Enhancement
**Voting UX** - Enhanced with state transition animations and visual feedback

**Features**:
- Defaults to HUMAN (optimistic assumption)
- Animated hint in first 5 seconds (wiggle left/right)
- Locked state indicator with 🔒
- Responsive sizing (compact mode for side-by-side)
- Vote result feedback animation when vote finalizes
  - Correct: subtle scale-up + glow pulse for 1.5s
  - Incorrect: subtle shake + color shift for 1.5s

**Visual Connection to Vote State**:
- Desktop: color-coded borders on chat windows (green=voting HUMAN, red=voting BOT)
- Mobile: color-coded tab indicator
- Each chat has independent VoteToggle state

---

## Homepage Redesign

### Architecture
**New Directory Structure**:
```
src/components/game/
├── GameStateView.tsx          # Orchestrator for authenticated users
├── GameStatusCard.tsx         # Pre-auth dynamic status display
├── GameLobby.tsx              # REGISTRATION phase
├── GameActiveView.tsx         # LIVE phase
└── GameFinishedView.tsx       # FINISHED phase
```

### State Machine Flow
```
PRE-AUTH (Unauthenticated)
│
├─→ GameStatusCard
│   ├─ REGISTRATION: "Join now • 45s left"
│   ├─ LIVE: "12 players competing • 2:30 remaining"
│   └─ FINISHED: "View leaderboard • Next in 45s"
│
└─→ AuthInput

POST-AUTH (Authenticated)
│
└─→ GameStateView
    ├─ REGISTRATION → GameLobby
    │  ├─ Lobby phase (register, view players)
    │  ├─ Bot generation (AI opponent creation)
    │  ├─ Player reveal (meet your opponents)
    │  └─ Countdown (game starts in 5...4...3...)
    │
    ├─ LIVE → GameActiveView
    │  └─ MultiChatContainer (2 simultaneous chats)
    │
    └─ FINISHED → GameFinishedView
       ├─ Leaderboard
       └─ Next cycle countdown
```

### GameStatusCard (Pre-Auth Discovery)
Shows live game state to unauthenticated users, creating FOMO and urgency.

**Features**:
- Real-time countdown timers
- Dynamic messaging based on game state
- Player count display
- Call-to-action for each phase
- Consistent styling with game theme

**States**:
```
⏱️ REGISTRATION OPEN
Join now and compete • 45 seconds left
X players registered

🎮 GAME LIVE  
X players are competing right now • 2:30 remaining
(Live indicator with pulsing dot)

🏆 GAME FINISHED
View the leaderboard and see who won
Next round in 45 seconds
```

---

## Opponent Reveal Flow Redesign

### Problem → Solution
**Old Flow (Poor UX)**:
- Sequential reveals: Match 1 completes → 2s reveal → Match 2 completes → 2s reveal → jarring blank loading screen
- Players barely process "was it a bot?" before modal vanishes
- No context during loading, just a spinner
- Rushed transition (4s total reveals + loading = disconnected experience)

**New Flow (Unified Experience)**:
- Batch reveals: All round matches complete → unified reveal screen with both opponents + stats
- 6 second display minimum (easily adjustable to 5-8s)
- Shows real-time progress: accuracy, rank, matches this round, next round countdown
- Smooth fade into loading state (RoundStartLoader) instead of jarring blank screen
- Single modal handles reveal + stats + context + auto-dismiss

### User Experience Flow
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

## Design Principles Applied

### ✅ Consistency
- Uses existing design system (white/5, borders, rounded corners)
- Matches mission briefing styling
- Maintains typography hierarchy

### ✅ Minimalism
- 4 compact cards in a 2x2 grid
- Emoji icons for visual interest
- Brief descriptions (2-3 words + details)
- Subtle hover effects

### ✅ Information Hierarchy
1. Mission Briefing (primary)
2. What Makes Us Different (secondary highlight)
3. Admin Panel (footer)

### ✅ Responsiveness
- 2 columns on mobile/tablet
- Maintains compact width (max-w-md)
- Scales text appropriately

### ✅ Mobile-First Design
```
Mobile (1 column):          Tablet (2 columns):
┌──────────────────┐       ┌───────────┬───────────┐
│ 📊 4 Leaderboard │       │ 📊 4 LB   │ 🌐 Multi │
│    Modes         │       ├───────────┼───────────┤
├──────────────────┤       │ ⚡ Real   │ 🤖 AI    │
│ 🌐 Multi-Chain   │       └───────────┴───────────┘
│    Support       │
├──────────────────┤
│ ⚡ Real-Time     │
│    Analytics     │
├──────────────────┤
│ 🤖 AI Opponents  │
└──────────────────┘
```

## Game Flow Implementation: No Mid-Game Results

### Key Principle
Auto-lock votes on server; show opponent reveal briefly; display final results only after all matches complete.

### Architecture Changes

#### Server-Side Vote Auto-Lock
When `getActiveMatches()` detects an expired unvoted match, it automatically locks the vote. Backend is now the source of truth.

```typescript
if (match.endTime <= now && !match.voteLocked) {
  // Auto-lock vote when time expires
  this.lockMatchVote(matchId);
}
```

#### Enhanced ResultsCard Component
Multi-mode component handling 3 display types:
- **`opponent-reveal`** - Shows opponent identity for 2 seconds (no correctness shown)
- **`round-summary`** - Round accuracy (unused currently, available for future)
- **`game-complete`** - Full game results with accuracy, rank, round breakdown

#### Enhanced Leaderboard Component
Dual-mode component with tab switcher:
- **`current`** - Current game leaderboard (existing functionality)
- **`career`** - Career stats dashboard showing:
  - Total games, overall accuracy, best/worst game, avg decision speed
  - Game history with per-game rank & accuracy
  - Dynamic insights based on playstyle

### Component Architecture
**Before (Bloated)**:
```
MultiChatContainer
├─ OpponentRevealCard
├─ EndGameResultsScreen
└─ Leaderboard
   ├─ CareerStatsPage (via separate route)
```

**After (Consolidated)**:
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

## Visual Consistency Maintained
- **Background**: Starfield + Grid Backdrop (unchanged)
- **Typography**: Mission Briefing style (unchanged)
- **Colors**: white/5, white/10, white/50 borders (consistent)
- **Spacing**: Gap of 3 pixels, padding 3 (consistent grid)
- **Interactivity**: Hover effects (white/10) (consistent)

## UX Improvements from Recent Development

Based on recent development work, several UX improvements have been implemented to enhance the user experience:

### Enhanced Phase Transitions
**Problem**: GameLobby had 4 phases (lobby → bot_generation → player_reveal → countdown → live) but the logic for triggering transitions was fragile with hardcoded timeouts.

**Solution**:
- Now uses server-driven phase transitions with `/api/game/phase` endpoint
- Users never see "Preparing next round..." for 15+ seconds
- Phase transitions happen exactly when server says so, not on client timer
- Handles network failures gracefully with clear error messaging

### Improved Modal System
**Problem**: Reveal screen pops up while voting, causing confusion about priority and overlapping modals.

**Solution**:
- Created ModalStack context provider for centralized modal management
- All overlays (reveal, error, loading) now have consistent z-index management
- No more overlapping modals fighting for attention
- Proper auto-close behavior with configurable timers

### Better Loading States
**Problem**: RegistrationLoader + RoundStartLoader were nearly identical (90% code duplication) creating maintenance issues.

**Solution**:
- Created single LoadingOverlay component with 5 variants
- Supports: registration, round-start, preparing, reveal, generic
- Consistent loading experience with configurable progress indicators
- Eliminates code duplication and improves maintainability

### Enhanced Vote Toggle UX
**Problem**: Users didn't know WHEN vote locks, no visual feedback about time pressure.

**Solution**:
- Added three-tier warning system to VoteToggle:
  - **Normal (> 10s)**: Hint text: "↑ Click to change your vote"
  - **Warning (3-10s)**: Yellow alert: "⚠️ 10 seconds to lock"
  - **Critical (< 3s)**: Red pulsing: "🔒 LOCKING IN 3s"
  - **Locked (= 0)**: Disabled state: "🔒 Vote locked"
- Vote toggle disables when time expires
- Visual feedback at critical time intervals

### Timer Consistency
**Problem**: Multiple countdown timers scattered across components, each with slightly different logic.

**Solution**:
- Created custom `useCountdown` hook with consistent interface
- Single source of truth for ALL countdown timers
- Smooth 100ms polling for responsive UI
- Server-synced via timeOffset
- All timers now behave consistently

### Clear Auth Flow
**Problem**: Users saw multiple auth options but couldn't tell which worked, with confusing TODO comments.

**Solution**:
- Removed all TODO comments from authentication flow
- Single clear auth path: Farcaster SDK with web mode fallback
- Users see one button, one clear flow
- Clear indication whether in SDK or web mode

This consolidated design approach ensures Detective provides an immersive, polished experience while maintaining the core mystery and social deduction elements that make the game compelling.