# Negotiation Mode - Quick Start Guide

## For Developers

### Enable Negotiation Mode

```bash
# Via Admin API
curl -X POST http://localhost:3000/api/admin/state \
  -H "x-admin-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"action":"update-config","config":{"mode":"negotiation"}}'
```

### Check Current Mode

```bash
curl http://localhost:3000/api/game/status
# Response includes: "mode": "negotiation"
```

### Register Player (Optional Mode Override)

```javascript
fetch('/api/game/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fid: 12345,
    mode: 'negotiation' // Optional, uses game default if omitted
  })
});
```

### Make Negotiation Action

```javascript
// Propose a split
fetch('/api/negotiation/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    matchId: 'match-123',
    action: 'propose',
    message: 'I propose we split fairly',
    proposal: {
      myShare: { books: 2, hats: 2, balls: 2 },
      theirShare: { books: 1, hats: 1, balls: 1 }
    }
  })
});

// Accept current proposal
fetch('/api/negotiation/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    matchId: 'match-123',
    action: 'accept',
    message: 'I accept this deal'
  })
});

// Reject and continue
fetch('/api/negotiation/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    matchId: 'match-123',
    action: 'reject',
    message: "Let's keep negotiating"
  })
});
```

## For Frontend Developers

### Type Guards

```typescript
import { isNegotiationMatch } from '@/lib/gameMode';

if (isNegotiationMatch(match)) {
  // TypeScript knows this is NegotiationMatch
  const { resourcePool, playerValuation, rounds } = match;
}
```

### Display Mode Info

```typescript
import { getModeName, getModeDescription, getModeIcon } from '@/lib/gameMode';

const name = getModeName('negotiation'); // "Negotiation"
const desc = getModeDescription('negotiation'); // "Outsmart AI in resource deals"
const icon = getModeIcon('negotiation'); // "🤝"
```

### Calculate Scores

```typescript
import { calculateMatchScore } from '@/lib/gameMode';

// Works for any mode (conversation or negotiation)
const score = calculateMatchScore(match);
```

### Validate Proposals

```typescript
import { validateProposal } from '@/lib/gameMode';

const result = validateProposal(myShare, theirShare, resourcePool);
if (!result.valid) {
  console.error(result.error);
}
```

## Game Mechanics

### Resources
- **Books**, **Hats**, **Balls** (2-4 of each)
- Hidden valuations: 2, 4, 6, 8, or 10 points per unit
- Goal: Get high-value items

### Actions
1. **Propose**: Offer a split (must sum to pool)
2. **Accept**: Accept current proposal (ends match)
3. **Reject**: Continue negotiating

### Scoring
- Deal: Score = (your items × your valuations) / max possible
- No deal: -0.5 penalty
- Range: -0.5 to 1.0

### Timing
- 5 rounds maximum
- 1 minute per round
- Auto-timeout if no deal reached

## Testing

```bash
# Test API structure
node scripts/test-negotiation.js

# Test full flow (requires server + admin secret)
ADMIN_SECRET=your-secret node scripts/test-negotiation-flow.js
```

## Common Patterns

### Check if negotiation is active

```typescript
const config = await gameManager.getConfig();
if (config.mode === 'negotiation') {
  // Show negotiation UI
}
```

### Handle match timeout

```typescript
// Automatic in cleanupOldMatches()
// Or manually:
await gameManager.handleNegotiationTimeout(matchId);
```

### Get negotiation state

```typescript
if (isNegotiationMatch(match)) {
  const currentRound = match.rounds.length;
  const hasProposal = !!match.currentProposal;
  const isFinished = match.outcome !== undefined;
}
```

## UI Components Needed (Phase 2)

1. **Mode Selector** - Choose conversation or negotiation
2. **Resource Display** - Show books, hats, balls with valuations
3. **Proposal Builder** - Drag/drop or input resource splits
4. **Action Buttons** - Propose, Accept, Reject
5. **Round History** - Show past proposals and responses
6. **Score Display** - Show current score and potential outcomes

## API Response Examples

### Successful Proposal
```json
{
  "success": true,
  "match": {
    "id": "match-123",
    "mode": "negotiation",
    "rounds": [
      {
        "roundNumber": 1,
        "action": "propose",
        "proposal": {
          "myShare": { "books": 2, "hats": 2, "balls": 2 },
          "theirShare": { "books": 1, "hats": 1, "balls": 1 }
        },
        "message": "Fair split",
        "timestamp": 1234567890
      }
    ],
    "currentProposal": { ... }
  }
}
```

### Deal Reached
```json
{
  "success": true,
  "match": { ... },
  "outcome": {
    "dealReached": true,
    "finalProposal": { ... },
    "playerScore": 0.75,
    "opponentScore": 0.60,
    "rounds": 3
  }
}
```

### No Deal (Timeout)
```json
{
  "outcome": {
    "dealReached": false,
    "playerScore": -0.5,
    "opponentScore": -0.5,
    "rounds": 5
  }
}
```

## Troubleshooting

### "Not a negotiation match"
- Check game mode: `GET /api/game/status`
- Verify match was created after mode switch

### "Match not found"
- Ensure match ID is correct
- Check match hasn't expired (1 minute timeout)

### "Proposal validation failed"
- Verify resources sum to pool
- Check all resource types included

### Bot not responding
- Bot responses are automatic after player actions
- Check response includes `botAction` field

## Next Steps

1. Build UI components (Phase 2)
2. Integrate LLM for bot strategy (Phase 3)
3. Add analytics and insights (Phase 4)

## Resources

- Full docs: `docs/NEGOTIATION_MODE.md`
- Implementation summary: `.implementation-summary.md`
- Test scripts: `scripts/test-negotiation*.js`
