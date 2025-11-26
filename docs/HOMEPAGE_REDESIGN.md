# Homepage Redesign - Complete

## Overview

Unified and consolidated the game homepage to show dynamic game state at every phase, creating a cohesive user experience from discovery through gameplay.

## Architecture

### New Directory Structure
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

## Components

### GameStatusCard (NEW - Pre-Auth Discovery)
Shows live game state to unauthenticated users, creating FOMO and urgency.

**Features:**
- Real-time countdown timers
- Dynamic messaging based on game state
- Player count display
- Call-to-action for each phase
- Consistent styling with game theme

**States:**
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

### GameStateView (Orchestrator)
Single source of truth for authenticated users. Routes to appropriate view based on game state and handles cross-cutting concerns.

**Responsibilities:**
- State machine routing (REGISTRATION → LIVE → FINISHED)
- Game start notifications
- Player context management
- Access control (e.g., "not registered" error for LIVE state)

### GameLobby (REGISTRATION Phase)
Displays lobby interface with player list, registration progress, and game start sequence.

**Sub-phases:**
1. **Lobby** - Registration interface, player list, countdown
2. **Bot Generation** - AI opponent creation animation
3. **Player Reveal** - Meet your real players and AI bots
4. **Countdown** - "Game starts in 5...4...3..."

### GameActiveView (LIVE Phase)
Minimal wrapper around MultiChatContainer for active gameplay with 2 simultaneous chats.

### GameFinishedView (FINISHED Phase)
Displays final leaderboard and countdown to next game cycle.

## Key Improvements

### For Users
✅ **Discoverability** - Game state visible before login (no hidden activity)  
✅ **FOMO Factor** - See live competition happening now  
✅ **Clear CTAs** - "Join Now" / "View Results" based on state  
✅ **Transparency** - Know exactly what's happening and when next phase starts  

### For Code
✅ **Single Source of Truth** - All game state logic in GameStateView  
✅ **No Duplication** - Eliminated scattered state management  
✅ **Modular** - Each component has one responsibility  
✅ **Testable** - Clear props, predictable behavior  
✅ **DRY** - Consolidated notification logic  
✅ **Organized** - Domain-driven structure in /game directory  

## Migration Notes

### Removed
- GameStartNotification.tsx (logic moved to GameStateView)
- GameRegister.tsx (split into GameLobby + GameStateView)
- Scattered game state logic from page.tsx

### Updated
- ErrorCard.tsx - Added support for link-based actions
- page.tsx - Simplified to render GameStatusCard (pre-auth) or GameStateView (post-auth)

## Design Consistency

All components follow the established Detective theme:
- **Colors**: Blue/purple gradients for registration, purple/pink for live, amber/orange for finished
- **Typography**: hero-title for headers, consistent sizing
- **Spacing**: Consistent padding and gap scales
- **Animations**: Fade-in, pulse, bounce for state transitions
- **Icons**: Emoji-based (⏱️, 🎮, 🏆) for quick recognition

## Future Enhancements

### Farcaster Mini-App Integration
The notification system in GameStateView is abstracted and ready for mini-app API:
```typescript
// Currently using sendGameStartNotification()
// Can be swapped for Farcaster mini-app notification API
```

### Analytics Hooks
GameStatusCard provides natural places to track:
- Pre-auth engagement with game state
- CTAs clicked (join, view results)
- Time-based drop-off analysis

### Real-Time Updates
GameStatusCard and GameStateView both poll `/api/game/status` at 3-second intervals. Could upgrade to WebSocket for instant updates.

## Testing Checklist

- [ ] Pre-auth GameStatusCard shows correct state based on game time
- [ ] Timers count down accurately
- [ ] Post-auth routing goes to correct view per game state
- [ ] GameLobby transitions through all phases
- [ ] GameActiveView renders chat interface
- [ ] GameFinishedView shows leaderboard + countdown
- [ ] Responsive design on mobile
- [ ] Animations smooth and performant
