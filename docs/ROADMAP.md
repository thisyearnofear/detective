# Detective: Farcaster Edition - Roadmap

## Executive Summary

Migrate Detective from a Twitter OAuth + MySQL multiplayer game into a **Farcaster-native mini app** that leverages real user content to create an AI-powered guessing game. Core innovation: Match users with intelligent bots trained on their Farcaster posts, creating authentic social deduction gameplay.

**Constraints**: 
- **50 concurrent players max** per game cycle
- **Neynar Quality Filter**: Score > 0.8 (ensures quality participants)
- **No database required** initially (game state in memory, Farcaster owns social graph)
- **Simple deployment**: Vercel serverless functions
- **Privacy-first inference**: Venice AI (no logging, no training on game data)

**Status**: Phase 1 ✅ COMPLETE (Nov 24, 2025)  
**Current Phase**: Phase 2 (AI Integration & Polish) - In Progress

**Feasibility: 9/10 (Very High)** — Severely constrained scope eliminates most scaling concerns. Game state can live in-memory per session.

---

## 1. Game Mechanics (Refined)

### Core Loop
1. **Registration Phase** (T0 → T1): Users opt-in via Farcaster mini app
   - System scrapes their recent posts, profile, engagement patterns
   - **Quality Gate**: Only accept users with Neynar Score > 0.8
   - Store user context in-memory (no database)
   - **Hard cap**: First 50 registrants per game cycle

2. **Game Live Phase** (T1 → T2, typically 24-72 hours)
   - **Matching**: Users randomly paired with either:
     - Another real user (50% probability)
     - An AI bot trained on scraped user data (50% probability)
   - **Conversation**: 3-5 minute timed chat
   - **Voting**: User guesses: "Real Person" or "Bot"
   - **Rounds**: 3-5 matches per user over game period

3. **Scoring Phase** (After T2)
   - **Accuracy Metric**: `(Correct Guesses / Total Guesses) × 100`
   - **Tiebreaker**: Speed of correct guesses
   - **Leaderboard**: Global + channel-specific rankings
   - **Rewards**: [Optional] NFT badges, creator revenue share

### Why This Works for Farcaster
- **Social Discovery**: Users learn about others through conversation
- **Creator Incentives**: Engagement metrics drive visibility
- **On-Platform**: Mini app lives entirely in Warpcast feed
- **Viral Loop**: Leaderboard displays naturally within casts

---

## 2. Technical Architecture

### High-Level System Design (Simplified for 50 Concurrent)
```
┌─────────────────────────────────────────────────────────┐
│           FARCASTER CLIENT (Warpcast)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Mini App (Next.js in WebView)                   │   │
│  │  - Auth via Farcaster SDK                        │   │
│  │  - Chat UI / Voting Interface                    │   │
│  │  - Leaderboard / Profile                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↕ (HTTP/SSE)
┌─────────────────────────────────────────────────────────┐
│           BACKEND API (Next.js API Routes)              │
│           [Game State in Memory per Session]            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ /api/game/register - Validate & enqueue user    │   │
│  │ /api/game/status - Get current game state       │   │
│  │ /api/match/next - Get next matched user/bot     │   │
│  │ /api/chat/send - Relay message or generate bot  │   │
│  │ /api/vote/submit - Record guess & calc score    │   │
│  │ /api/leaderboard - In-memory rankings           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ↕ (HTTP)             ↕ (HTTP)
    ┌─────────────┐    ┌──────────────┐
    │ Neynar API  │    │ LLM Provider │
    │ (Validate   │    │ (Claude/GPT) │
    │  user score)│    │ (Bot Brain)  │
    └─────────────┘    └──────────────┘
```
**Note**: No persistent database. Game state stored in-memory (Vercel KV optional for cross-instance sync). Results exported as casts post-game.

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 15 + TypeScript + React 19 | Mini App SDK built for modern React |
| **Backend** | Next.js API Routes (serverless) | Unified codebase, Vercel deployment |
| **Auth** | @farcaster/miniapp-sdk | Native Farcaster authentication |
| **Game State** | In-memory (Map/Record) + Vercel KV (optional) | 50 players = negligible memory footprint |
| **Real-time Chat** | HTTP polling (3s interval) | Simplicity over elegance at this scale |
| **AI/Bot** | Venice AI (Llama 3.3 70B) | Privacy-first (~$2.80/1M output tokens), no logging |
| **Farcaster Data** | Neynar API | User validation, score filtering, content scraping |
| **Hosting** | Vercel | Free tier sufficient for this load |
| **Styling** | Tailwind CSS | Rapid UI iteration |

---

## 3. Development Phases

### Phase 1: MVP Foundation (1-2 weeks) ✅ COMPLETE
**Goal**: Core game loop works, single game cycle, no database

**Completed**:
- [x] Project Setup
  - ✅ Next.js 15 + TypeScript + React 19
  - ✅ @farcaster/miniapp-sdk integrated
  - ✅ Neynar SDK & Venice AI installed
  - ✅ Environment configuration (.env.example)
- [x] Core Game Logic
  - ✅ In-memory game state store (`gameState.ts`)
  - ✅ User, Match, Game, Leaderboard data structures
  - ✅ Neynar API client (`neynar.ts`)
  - ✅ Venice AI bot logic (`claude.ts` → will be `inference.ts`)
- [x] Landing Page
  - ✅ Farcaster SDK initialization
  - ✅ How-to-play instructions
  - ✅ Game status display
- [x] Build & Deployment
  - ✅ TypeScript compilation
  - ✅ Tailwind CSS styling
  - ✅ Git initialized

**Output**: Project scaffolding complete, ready for API/component implementation

---

### Phase 2: AI Integration & Polish (1 week) 🔄 IN PROGRESS
**Goal**: Believable bots, complete game loop, ready for beta testing

**To Build**:
- [ ] **API Routes**
  - [ ] `/api/game/register` - Validate Neynar score > 0.8, enqueue user, scrape casts
  - [ ] `/api/game/status` - Return current game cycle state
  - [ ] `/api/game/cycles` - List available cycles
  - [ ] `/api/match/next` - Assign next opponent (50% real, 50% bot)
  - [ ] `/api/chat/send` - Relay message or generate Venice AI response
  - [ ] `/api/chat/poll` - Poll for new messages (3s interval)
  - [ ] `/api/vote/submit` - Record guess, calculate accuracy
  - [ ] `/api/leaderboard/current` - Return sorted rankings

- [ ] **React Components**
  - [ ] `GameRegister.tsx` - Registration form with Neynar validation UI
  - [ ] `ChatWindow.tsx` - Real-time chat with message polling
  - [ ] `Timer.tsx` - 4-minute countdown with visual feedback
  - [ ] `VotingPanel.tsx` - Real/Bot selection with results
  - [ ] `Leaderboard.tsx` - Rankings with user stats
  - [ ] `GameStatus.tsx` - Current cycle info & player count

- [ ] **Inference Engine**
  - [ ] Rename `lib/claude.ts` → `lib/inference.ts`
  - [ ] Update to use Venice AI (Llama 3.3 70B) instead of Claude
  - [ ] Implement system prompt with Farcaster tone injection
  - [ ] Add response caching for repeated questions
  - [ ] Cost tracking & monitoring

- [ ] **Matching Algorithm**
  - [ ] Pseudorandom pairing in `getNextMatch()`
  - [ ] Prevent user matching twice in same cycle
  - [ ] 50% real users / 50% bots balance
  - [ ] Match history tracking

- [ ] **User Testing**
  - [ ] Recruit 5-10 Farcaster beta users (score > 0.8)
  - [ ] Run 1-2 game cycles (3-4 hour sessions)
  - [ ] Collect feedback on bot believability
  - [ ] Adjust Venice AI prompts iteratively
  - [ ] Measure avg guess accuracy (target: 55%+ vs 50% random)

- [ ] **Privacy Communication**
  - [ ] Update landing page: "Venice AI - no logging, no training"
  - [ ] Add privacy notice in game
  - [ ] Marketing angle: Privacy-first game on Farcaster

**Output**: Fully playable game with Venice AI bots, tested with beta users

---

### Phase 3: Multi-Game Support (1 week, post-soft-launch)
**Goal**: Run repeated game cycles, measure retention

- [ ] **Game Lifecycle Management**
  - Simple admin interface to define game cycles:
    - Registration open/close times
    - Game start/end times
  - Cycle state machine: `REGISTRATION` → `LIVE` → `FINISHED`
  - Hardcoded initially, can add UI later

- [ ] **In-Memory State Persistence** (Optional)
  - Consider Vercel KV for multi-instance sync (if Vercel Pro)
  - Export final leaderboard as JSON
  - Allow users to cast leaderboard results (post-game)

- [ ] **Game Results Export**
  - Generate summary cast: "Final leaderboard: X users, top 5 winners"
  - Option for users to share their scores individually
  - Track metrics: total accuracy, average rounds played

- [ ] **Analytics Lite**
  - Simple dashboard: players registered, accuracy distribution
  - Cost tracking: Neynar API calls, Claude tokens
  - Log to console or simple JSON file

- [ ] **Security & Rate Limits**
  - Validate Farcaster SDK message signatures
  - Prevent double-voting (in-memory dedup)
  - Rate limit: 30 reqs/min per user
  - Secure API keys (Vercel env vars)

**Output**: Repeatable game cycles, basic analytics, soft launch ready

---

### Phase 4: Soft Launch (1 week)
**Goal**: First public game cycle

- [ ] **Final UI Polish**
  - Mobile-first responsive design (Warpcast is mobile-first)
  - Error messages & edge cases
  - Loading states on all API calls
  - Graceful degradation if APIs fail

- [ ] **Leaderboard & Results**
  - Live leaderboard during game
  - Final results screen with accuracy stats
  - Share button: "I got X% correct on @detective"
  - User-specific stats

- [ ] **Public Launch Prep**
  - Production deployment (Vercel)
  - Announce in Farcaster channels
  - Invite first 50 beta users

- [ ] **Monitoring**
  - Log API errors & response times
  - Track costs (Neynar, Claude)
  - Monitor Vercel function execution

**Output**: First playable public game, data on user retention

---

### Phase 5: Growth & Refinement (Post-Soft-Launch)
**Goal**: Repeat players, refined core loop

- [ ] **Iterative Improvements**
  - Adjust match timing based on feedback (3-4 min sweet spot?)
  - Refine Claude prompts based on user comments
  - Add 2-3 more game cycles (weekly)
  - Measure retention: % of users returning for cycle 2+

- [ ] **Optional Enhancements**
  - Achievements/badges (simple SVG in UI)
  - Seasonal themes or special events
  - Leaderboard persistence (lightweight: JSON export)
  - User profiles with historical stats

- [ ] **Community & Monetization** (TBD)
  - Dedicated Farcaster channel (@detective)
  - Eventual NFT for top scorers (post-Phase 5)
  - Potential Farcaster grants or ecosystem partnerships

**Output**: Sustainable game loop, repeat-play data, roadmap to scale

---

## 4. Dependency & Integration Checklist

### Required Third-Party Services

| Service | Purpose | Cost | Status |
|---------|---------|------|--------|
| **Neynar API** | Farcaster content scraping, user validation | Free tier (10k req/day) | ✓ Essential |
| **Venice AI API** | Bot intelligence (Llama 3.3 70B, privacy-first) | ~$0.70/game (250 responses) | ✓ Essential |
| **Vercel** | Hosting & deployment | Free tier (sufficient for 50 users) | ✓ Essential |
| **No Database** | Game state in-memory | Free | ✓ MVP Phase |
| **Vercel KV** | Optional: Multi-instance sync | $5-10/mo | ○ Phase 3+ |
| **Sentry** | Error tracking (optional) | Free tier | ○ Nice-to-have |

### Environment Variables (.env.local)
```
# Farcaster Mini App SDK
NEXT_PUBLIC_FARCASTER_HUB_URL=https://hub.farcaster.xyz

# Neynar API (get at https://neynar.com/app/api-keys)
NEYNAR_API_KEY=your_neynar_api_key

# Venice AI API (get at https://venice.ai/settings/api)
VENICE_API_KEY=your_venice_api_key

# Optional: Vercel KV (Phase 3+)
# KV_URL=...
# KV_REST_API_TOKEN=...

# Optional: Error tracking
# SENTRY_DSN=...
```

---

## 5. Feasibility Assessment

### ✅ Highly Feasible (Low Risk)
1. **User Authentication** - Farcaster SDK mature & battle-tested
2. **Content Scraping** - Neynar quality filtering (score > 0.8) reduces abuse
3. **Chat UI** - Standard React components, no complex state
4. **In-Memory Game State** - 50 players = ~1-2 MB RAM footprint, negligible
5. **Next.js Deployment** - Vercel free tier handles this easily
6. **HTTP Polling** - Simple, proven pattern for real-time chat

### ⚠️ Moderate Risk (Manageable)
1. **AI Bot Believability** - Requires prompt engineering & user testing
   - *Mitigation*: Start with Claude defaults, iterate on feedback per cycle
2. **Neynar Free Tier (10k req/day)** - Ample for 50 players (~200 reqs/game)
   - *Mitigation*: Batch scraping, cache responses, monitor costs
3. **Claude API Cost** - ~$1-2 per game (50 players × 5 rounds = 250 bot responses)
   - *Mitigation*: Acceptable MVP cost, budget $50-100/month

### 🟢 Very Low Risk
1. **Farcaster Mini App Ecosystem** - Production-ready as of 2025
2. **User Privacy** - Only scraping public posts; add disclaimer in signup
3. **Game State Loss** - Acceptable for MVP (restart game cycle if service fails)

---

## 6. Success Metrics & Launch Criteria

### MVP Playable Criteria (Phase 1, ~1 week)
- [ ] Game registers 2-3 test users via Farcaster SDK
- [ ] Neynar score filter works (rejects score < 0.8)
- [ ] Chat works: real user messages relay properly
- [ ] Bot responses generate via Claude API
- [ ] Voting & leaderboard calculate correctly (in-memory)
- [ ] No crashes during 30-minute test session

### Phase 2 Polish Criteria (~1 week)
- [ ] Bot responses feel "human-like" (5-10 testers, subjective feedback)
- [ ] Claude costs tracked (~$1-2 per test game)
- [ ] Mobile UI responsive on iOS/Android
- [ ] Error handling for API failures graceful

### Soft Launch Criteria (Phase 3-4, ~2 weeks)
- [ ] Production deployment on Vercel working
- [ ] First 50-user game cycle completes without major bugs
- [ ] Final leaderboard exports as cast
- [ ] Cost tracking shows ~$2-5 per game

### Post-Launch Success Metrics (Phase 5)
- **Engagement**: 80%+ of registered users play all 5 matches
- **Retention**: 50%+ return for game cycle 2 (weekly)
- **Accuracy**: Average guess accuracy 55%+ (vs 50% random)
- **Community**: Organic growth to 200+ players/cycle within 1 month

---

## 7. Open Questions & Decisions

1. **Matching Strategy**: How do we handle odd player counts? Keep bots in rotation?
   - *Suggested*: Odd players always match with a bot
2. **Chat Duration**: 3-5 minutes seems right, but validate?
   - *Suggested*: Start with 4 minutes, allow admin override
3. **Rounds Per Game**: 3-5 matches per player per cycle?
   - *Suggested*: 5 rounds for depth, but make configurable
4. **Revenue Model**: Are we monetizing? If yes, when?
   - *Suggested*: Phase 2-3 assessment; start with engagement focus
5. **Moderation**: Who flags inappropriate messages?
   - *Suggested*: Auto-flag certain words, human review in Phase 3+
6. **Bot Training Data**: Fresh scrape per game or cached profiles?
   - *Suggested*: Fresh scrape (24h cache) to capture latest user tone

---

## 8. Rollout Plan

### Week 1-2 (Internal Test)
- Deploy MVP to private channel
- 5-10 internal testers
- Gather feedback

### Week 3-4 (Beta / Trusted Users)
- Invite 100-200 trusted Farcaster users
- Monitor for bugs, costs
- Refine bot prompts

### Week 5+ (Public Launch)
- Announce in `@detective` channel
- First game cycle: 24-48 hour duration
- Aim for 500-1,000 registrations
- Iterate on feedback

---

## 9. Repository Structure

```
detective/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Home/landing
│   │   ├── layout.tsx               # Root layout
│   │   └── api/
│   │       ├── game/
│   │       │   ├── register.ts      # POST: Register user
│   │       │   ├── status.ts        # GET: Game state
│   │       │   └── cycles.ts        # GET: List game cycles
│   │       ├── match/
│   │       │   └── next.ts          # GET: Get next opponent
│   │       ├── chat/
│   │       │   ├── send.ts          # POST: Send message (relays or generates)
│   │       │   └── poll.ts          # GET: Poll for new messages
│   │       ├── vote/
│   │       │   └── submit.ts        # POST: Submit guess
│   │       └── leaderboard/
│   │           └── current.ts       # GET: Leaderboard for active game
│   ├── components/
│   │   ├── GameRegister.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── VotingPanel.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── Timer.tsx
│   │   └── GameStatus.tsx
│   ├── lib/
│   │   ├── gameState.ts             # In-memory state (Map-based)
│   │   ├── neynar.ts                # Neynar API calls
│   │   ├── claude.ts                # Claude API calls
│   │   ├── types.ts                 # TypeScript types
│   │   └── utils.ts                 # Helpers
│   ├── styles/
│   │   └── globals.css
│   └── hooks/
│       ├── useFarcasterUser.ts
│       ├── useGameState.ts
│       └── usePolling.ts
├── public/
│   ├── mini-app.manifest.json
│   └── favicon.ico
├── .env.example
├── .env.local (git-ignored)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
├── README.md
└── ROADMAP.md
```

---

## 10. Risk & Mitigation Summary

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| Neynar API rate limits (10k/day) | Medium | Low | 50 players = ~200 reqs/game. Monitor, upgrade if needed. |
| Claude API costs escalate | Low | Low | ~$1-2/game for 50 players. Budget $50-100/month. |
| Bot responses not believable | High | Medium | Iterate prompts per cycle, A/B test with feedback. |
| User churn after first cycle | High | Medium | Make cycle 2 registration easy, social sharing. |
| Game state lost on crash | Medium | Low | Acceptable for MVP; restart game. Add Vercel KV in Phase 3. |
| Farcaster SDK changes | Medium | Low | Pin versions, follow @farcaster/miniapps releases. |

---

## 11. Next Steps (Starting Now)

1. ✓ **Validate Plan** (this ROADMAP review)
2. **Setup Project** 
   - `create-next-app detective --typescript --tailwind`
   - Install: `@farcaster/miniapp-sdk`, `@anthropic-ai/sdk`, `neynar-sdk`
   - Create `.env.local` with API keys
   - Initialize git
3. **Create API Keys** (if not done)
   - Neynar: https://neynar.com/app/api-keys
   - Claude: https://console.anthropic.com/
   - Vercel: https://vercel.com/
4. **Begin Phase 1: MVP Foundation** (target: 1-2 weeks)
   - Game state store (in-memory)
   - Farcaster SDK integration
   - Neynar quality filtering (score > 0.8)
   - Chat interface (HTTP polling)
   - Claude bot integration

---

## Conclusion

**This plan is feasible and realistic.** Key highlights:

**Technical Feasibility: 9/10**
- No database required (game state in-memory)
- 50 concurrent players = simple infrastructure
- Proven tech stack (Next.js, Claude, Neynar)
- Vercel free tier sufficient for MVP

**Timeline: 3-4 weeks**
- Phase 1 MVP: 1-2 weeks (playable game)
- Phase 2 Polish: 1 week (believable bots)
- Phase 3-4 Launch: 1-2 weeks (first public cycle)

**Monthly Costs**
- Neynar: Free tier (10k req/day, ample for 50 players)
- Claude: $50-100/month (assuming 5-10 games)
- Vercel: Free tier
- **Total**: ~$50-100/month

**Biggest Unknown**: User retention beyond first game cycle. This is solved through iteration, community engagement, and refinement.

**Ready to migrate?** Let's start Phase 1 now.
