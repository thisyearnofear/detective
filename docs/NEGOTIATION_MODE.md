# Negotiation Mode Implementation

## Overview

Negotiation mode is an alternative game mode where players negotiate resource splits with AI opponents over 5 rounds. Players aim to maximize their score based on hidden valuations.

## Architecture

### Core Principles Applied
- **ENHANCEMENT FIRST**: Extends existing Match infrastructure
- **DRY**: Single source of truth in `gameMode.ts`
- **MODULAR**: Isolated logic in `negotiation.ts`
- **CLEAN**: Separate API endpoints

### File Structure

```
src/lib/
├── types.ts              # Type definitions (GameMode, NegotiationMatch, etc.)
├── gameMode.ts           # Mode utilities (180 lines)
├── negotiation.ts        # Negotiation logic (280 lines)
└── gameState.ts          # Game manager (updated for mode support)

src/app/api/
├── game/
│   ├── register/route.ts # Updated: mode selection
│   └── status/route.ts   # Updated: includes current mode
└── negotiation/
    └── action/route.ts   # New: negotiation actions (120 lines)
```

## Game Mechanics

### Resources
- **Books**, **Hats**, **Balls** (2-4 of each per match)
- Each player has hidden valuations (2, 4, 6, 8, 10 points per unit)
- Goal: Maximize your score by getting high-value items

### Actions
1. **Propose**: Offer a resource split
2. **Accept**: Accept current proposal (ends match)
3. **Reject**: Reject and continue negotiating

### Scoring
- Deal reached: Normalized score (0.0 to 1.0) based on your valuation
- No deal: -0.5 penalty for both players
- 5 rounds maximum (1 minute each)

## API Endpoints

### 1. Set Game Mode (Admin)
```bash
POST /api/admin/state
Headers: x-admin-secret: <secret>
Body: {
  "action": "update-config",
  "config": {
    "mode": "negotiation"
  }
}
```

### 2. Check Game Status
```bash
GET /api/game/status
Response: {
  "state": "REGISTRATION",
  "mode": "negotiation",
  ...
}
```

### 3. Register Player (Optional Mode)
```bash
POST /api/game/register
Body: {
  "fid": 12345,
  "mode": "negotiation"  # Optional, uses game default if omitted
}
```

### 4. Negotiation Action
```bash
POST /api/negotiation/action
Body: {
  "matchId": "match-123",
  "action": "propose",
  "message": "Let's split fairly",
  "proposal": {
    "myShare": { "books": 2, "hats": 2, "balls": 2 },
    "theirShare": { "books": 1, "hats": 1, "balls": 1 }
  }
}
```

## Testing

### Quick Test
```bash
# Test negotiation API structure
node scripts/test-negotiation.js

# Test full flow (requires admin secret)
ADMIN_SECRET=your-secret node scripts/test-negotiation-flow.js
```

### Manual Testing Flow
1. Set mode to negotiation via admin API
2. Register 3+ players
3. Wait for game to start (30s countdown)
4. Get active matches for a player
5. Test negotiation actions on those matches

## Bot Strategy

Current implementation uses a simple heuristic:
- Takes more of high-value items
- Gives more of low-value items
- Accepts if score > 0.4 or final round

**TODO**: Integrate LLM for behavioral economics strategy (anchoring, framing, reciprocity, loss aversion)

## Next Steps

### Phase 2: Basic UI (3 hours)
- [ ] Create `NegotiationInterface.tsx` component
- [ ] Add mode selector to homepage/registration
- [ ] Create resource display components
- [ ] Add proposal/accept/reject action buttons
- [ ] Test end-to-end flow

### Phase 3: Bot Strategy (2 hours)
- [ ] Integrate LLM into `generateBotNegotiationAction()`
- [ ] Implement behavioral economics tactics
- [ ] Test against Optimization Arena baseline

### Phase 4: Polish
- [ ] Add negotiation history display
- [ ] Show opponent's past behavior patterns
- [ ] Add analytics/insights after match
- [ ] Optimize for mobile

## Code Examples

### Type Guards
```typescript
import { isNegotiationMatch } from '@/lib/gameMode';

if (isNegotiationMatch(match)) {
  // TypeScript knows this is NegotiationMatch
  console.log(match.resourcePool);
}
```

### Scoring
```typescript
import { calculateMatchScore } from '@/lib/gameMode';

const score = calculateMatchScore(match); // Works for any mode
```

### Creating Matches
```typescript
// In gameState.ts createMatchForSlot()
if (gameMode === 'negotiation') {
  const { createNegotiationMatch } = require("./negotiation");
  return createNegotiationMatch(...);
}
```

## Backward Compatibility

- `Match.mode` is optional (defaults to 'conversation')
- Existing conversation matches continue to work
- Mode can be switched between games (not mid-game)
- All existing APIs remain unchanged

## Performance Considerations

- Negotiation matches use same infrastructure as conversation
- No additional database tables needed
- Match cleanup handles both modes
- Timeout handling integrated into existing cleanup cycle

## Security

- Mode validation in registration endpoint
- Match ownership verification in action endpoint
- Proposal validation (resources must sum to pool)
- Rate limiting applies to negotiation endpoints

## Monitoring

Key metrics to track:
- Deal success rate (% of matches with deals)
- Average rounds to deal
- Score distribution
- Bot strategy effectiveness
- Player engagement (negotiation vs conversation)
