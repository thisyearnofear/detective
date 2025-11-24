# Detective: Farcaster Mini App - Roadmap

## Vision

AI-powered social deduction game on Farcaster where players guess if they're chatting with real users or bots trained on their posts. **Dual distribution**: Farcaster Mini App (primary) + Web App (secondary).

**Constraints**: 50 players/cycle max, Neynar score >0.8, no database (in-memory state), Vercel serverless.

---

## Current Status

**Phase 1: Foundation ✅ COMPLETE**
- ✅ Next.js 15 + TypeScript + React 19
- ✅ In-memory game state (50 player capacity)
- ✅ Neynar API (validation, cast scraping)
- ✅ Venice AI bot logic (Llama 3.3 70B)
- ✅ All 8 API routes implemented
- ✅ All 5 React components built
- ✅ Farcaster SDK integration

**Current Blocker**: Web app parity for local testing

---

## Phase 2: Web App Parity (Current - 1 week)

### Goal
Enable local testing via web browser while maintaining Farcaster as primary distribution.

### Implementation

#### **2.1 Dual-Mode Authentication** (2 hours)
**Problem**: App currently requires Farcaster SDK, blocking web access.

**Solution**: Graceful fallback authentication.

**Changes**:
1. **Enhance `src/app/page.tsx`** (~30 lines)
   - Detect SDK availability with try/catch
   - Fallback to web mode if SDK unavailable
   - Add web auth state management

2. **Create `/api/auth/web/route.ts`** (~40 lines)
   - Accept Farcaster username
   - Lookup FID via Neynar
   - Return user profile
   - Reuse existing `getFarcasterUserData`

3. **Create `<AuthInput />` component** (~50 lines)
   - Username input form
   - Only shown when SDK unavailable
   - Calls `/api/auth/web`

**Result**: 
- Farcaster users: Auto-auth via SDK (unchanged)
- Web users: Enter username → Neynar lookup
- Both share same game state

#### **2.2 Local Testing Workflow** (1 hour)
**Setup**:
```bash
npm run dev
# Visit http://localhost:3000
# Enter your Farcaster username
# Test full game flow
```

**Benefits**:
- ✅ Test bot impersonations with real Farcaster data
- ✅ Fine-tune Venice AI prompts
- ✅ Validate game mechanics
- ✅ No need to recruit beta testers yet

#### **2.3 Bot Prompt Engineering** (3-4 days)
**Objective**: Make bots indistinguishable from real users.

**Process**:
1. Test with 10+ different Farcaster profiles
2. Evaluate bot responses for authenticity
3. Iterate on Venice AI system prompts
4. Target: >55% guess accuracy (vs 50% random)

**Metrics**:
- Bot response time (<2s)
- Character limit adherence (<240 chars)
- Tone matching (casual/formal/technical)
- Vocabulary consistency

#### **2.4 UI/UX Polish** (2 days)
- Mobile responsiveness (Warpcast is mobile-first)
- Loading states on all API calls
- Error handling (API failures, timeouts)
- Timer visual feedback
- Message animations

**Output**: Fully playable game on both web and Farcaster, ready for beta testing.

---

## Phase 3: Beta Testing (1 week)

### **3.1 Internal Testing** (2-3 days)
- 5-10 trusted Farcaster users
- 1-2 game cycles (4-6 hours each)
- Collect feedback on:
  - Bot believability
  - Match duration (4 min optimal?)
  - UI clarity
  - Mobile experience

### **3.2 Prompt Refinement** (2-3 days)
- Adjust Venice AI prompts based on feedback
- A/B test different system prompt variations
- Measure guess accuracy per bot profile

### **3.3 Cost Validation** (Ongoing)
- Track Venice AI token usage
- Monitor Neynar API calls
- Validate <$2/game estimate

**Success Criteria**:
- [ ] No crashes during 30-min sessions
- [ ] Bot responses feel human-like (subjective)
- [ ] Average guess accuracy 55%+ (vs 50% random)
- [ ] Mobile UI responsive on iOS/Android

---

## Phase 4: Soft Launch (1 week)

### **4.1 Production Deployment**
- Deploy to Vercel
- Configure environment variables
- Set up error monitoring (optional: Sentry)

### **4.2 First Public Game Cycle**
- Announce in Farcaster channels
- Invite first 50 beta users
- 24-48 hour game duration
- Monitor for bugs, costs

### **4.3 Results & Iteration**
- Export final leaderboard as cast
- Collect user feedback
- Measure retention (% returning for cycle 2)

**Success Criteria**:
- [ ] 50-user game completes without major bugs
- [ ] 80%+ of registered users play all 5 matches
- [ ] Cost tracking shows ~$2-5 per game
- [ ] Final leaderboard exports successfully

---

## Phase 5: Growth & Refinement (Ongoing)

### **5.1 Iterative Improvements**
- Adjust match timing based on feedback
- Refine Venice prompts per cycle
- Add 2-3 more game cycles (weekly)

### **5.2 Optional Enhancements**
- Achievements/badges (simple SVG)
- Seasonal themes
- User profiles with historical stats
- Leaderboard persistence (JSON export)

### **5.3 Community Building**
- Dedicated Farcaster channel (@detective)
- Share top moments/funny bot responses
- Potential Farcaster grants

**Success Metrics**:
- **Engagement**: 80%+ play all 5 matches
- **Retention**: 50%+ return for cycle 2
- **Accuracy**: 55%+ average (vs 50% random)
- **Growth**: 200+ players/cycle within 1 month

---

## Technical Architecture

### Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15 + React 19 + TypeScript | Modern, type-safe |
| Backend | Next.js API Routes | Serverless, unified codebase |
| Auth | Farcaster SDK + Web fallback | Dual distribution |
| State | In-memory (Map-based) | 50 players = negligible memory |
| Chat | HTTP polling (3s interval) | Simple, proven |
| AI | Venice AI (Llama 3.3 70B) | Privacy-first, OpenAI-compatible |
| Data | Neynar API | User validation, cast scraping |
| Host | Vercel | Free tier sufficient |

### API Routes (All Platform-Agnostic)
- `POST /api/game/register` - Register user
- `GET /api/game/status` - Current game state
- `GET /api/game/cycles` - List cycles
- `GET /api/match/next` - Get opponent
- `POST /api/chat/send` - Send message
- `GET /api/chat/poll` - Poll messages
- `POST /api/vote/submit` - Submit guess
- `GET /api/leaderboard/current` - Rankings

### Game Mechanics
1. **Registration**: Neynar score >0.8, max 50 players
2. **Matching**: 50% real users, 50% bots
3. **Chat**: 4-minute conversations
4. **Voting**: Guess "Real" or "Bot"
5. **Scoring**: Accuracy % (correct/total), speed tiebreaker
6. **Rounds**: 5 matches per player per cycle

---

## Costs (Estimated)

**Per game cycle** (50 players, 5 rounds = 250 bot responses):
- Neynar: Free tier (~200 calls << 10k/day limit)
- Venice AI: ~$0.70/game
- Vercel: Free tier
- **Total: <$1/game**

**Monthly** (10 games): ~$10 + overhead

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Bot responses not believable | High | Iterate prompts per cycle, A/B test |
| User churn after cycle 1 | High | Easy re-registration, social sharing |
| Neynar rate limits | Medium | 200 reqs/game << 10k/day, monitor usage |
| Venice costs escalate | Low | ~$1/game acceptable, budget $50-100/mo |
| Game state lost on crash | Medium | Acceptable for MVP, restart game |

---

## Environment Setup

```bash
# Required API Keys
NEYNAR_API_KEY=          # https://neynar.com/app/api-keys
VENICE_API_KEY=          # https://venice.ai/settings/api

# Optional
ANTHROPIC_API_KEY=       # Backup AI provider
```

---

## Next Steps (Immediate)

1. **Implement web auth fallback** (2 hours)
   - Enhance `page.tsx`
   - Create `/api/auth/web`
   - Create `<AuthInput />`

2. **Test locally** (Your part)
   - Run `npm run dev`
   - Enter Farcaster username
   - Test full game flow

3. **Fine-tune bot prompts** (3-4 days)
   - Test with 10+ profiles
   - Iterate on Venice prompts
   - Measure believability

4. **Polish UI** (2 days)
   - Mobile responsiveness
   - Error handling
   - Loading states

**Target**: Beta testing ready in 1 week.

---

## Core Principles Alignment

✅ **ENHANCEMENT FIRST**: Enhancing existing `page.tsx` vs creating separate apps  
✅ **AGGRESSIVE CONSOLIDATION**: 95% code shared between web/Farcaster  
✅ **PREVENT BLOAT**: Only 3 files for web parity (~120 lines)  
✅ **DRY**: Single game state, APIs, components  
✅ **CLEAN**: Clear auth separation (SDK vs web)  
✅ **MODULAR**: Reusable `<AuthInput />` component  
✅ **PERFORMANT**: No overhead for SDK users  
✅ **ORGANIZED**: Auth in `/api/auth`, game in `/api/game`

---

**Status**: Phase 1 ✅ | Phase 2 🔄 | Launch Target: Early December 2025
