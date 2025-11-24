# Detective Farcaster Mini App - Documentation Part 1: Overview & Architecture

## Executive Summary

Detective is an AI-powered social deduction game on Farcaster. Players engage in short conversations and guess whether they're speaking with another real user or an intelligent bot trained on that player's recent Farcaster posts, making the impersonation as authentic as possible.

### Core Concept

- **Game Type**: Social deduction game on Farcaster
- **Objective**: Guess if you're chatting with a real person or an AI bot
- **Innovation**: AI bots trained on real Farcaster users' posts for authentic impersonation
- **Platform**: Farcaster mini app (Warpcast native)

### Constraints & Design Philosophy

- **Max 50 concurrent players** per game cycle (to keep complexity low)
- **Neynar Quality Filter**: Score > 0.8 (ensures quality participants)
- **No database required initially**: Game state in memory (Farcaster owns social graph)
- **Simple deployment**: Vercel serverless functions for cost efficiency

---

## Game Mechanics

### Core Loop

1. **Registration Phase**: Users opt-in via Farcaster mini app, system validates quality via Neynar
2. **Game Live Phase**: Users randomly paired with real users (50%) or AI bots (50%) for 3-5 minute chats
3. **Voting Phase**: Users guess "Real Person" or "Bot" after each conversation
4. **Scoring Phase**: Accuracy calculated with speed tiebreaker, leaderboard generated

### Registration Requirements

- Users must have Neynar score > 0.8 (filters bots/low-quality accounts)
- Hard cap: 50 players per cycle
- System scrapes 30 recent casts per user for bot training

### Match Mechanics

- **Duration**: 4 minutes per match (configurable)
- **Rounds**: 5 matches per player per cycle
- **Assignment**: 50% real users, 50% bots in random assignment
- **Message Exchange**: HTTP polling (3s interval) for simplicity

### Bot Intelligence

- Venice AI (Llama 3.3 70B) via OpenAI SDK-compatible client
- System prompt injects: username, display name, top 10 recent casts, inferred tone and writing style
- Constraint: Stay under 240 characters (Farcaster limit)
- Never acknowledge being an AI

### Voting & Scoring

- After each match: Guess "Real" or "Bot"
- Accuracy calculated per user: (Correct Guesses / Total Guesses) × 100
- Tiebreaker: Speed of correct answers
- Leaderboard sorted by accuracy then speed

---

## Technical Architecture

### High-Level System Design

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
    │ (Validate   │    │ (Venice AI)  │
    │  user score)│    │ (Bot Brain)  │
    └─────────────┘    └──────────────┘
```

### Technology Stack

| Layer              | Technology                         | Rationale                                          |
| ------------------ | ---------------------------------- | -------------------------------------------------- |
| **Frontend**       | Next.js 15 + TypeScript + React 19 | Mini App SDK built for modern React                |
| **Backend**        | Next.js API Routes (serverless)    | Unified codebase, Vercel deployment                |
| **Auth**           | @farcaster/miniapp-sdk             | Native Farcaster authentication                    |
| **Game State**     | In-memory (Map/Record)             | 50 players = negligible memory footprint           |
| **Real-time Chat** | HTTP polling (3s interval)         | Simplicity over elegance at this scale             |
| **AI/Bot**         | Venice AI (Llama 3.3 70B)          | Privacy-first, OpenAI-compatible                   |
| **Farcaster Data** | Neynar API                         | User validation, score filtering, content scraping |
| **Hosting**        | Vercel                             | Free tier sufficient for this load                 |
| **Styling**        | Tailwind CSS                       | Rapid UI iteration                                 |

### API Reference

#### Game Management

- `POST /api/game/register` - Register user for game cycle
- `GET /api/game/status` - Get current game state
- `GET /api/game/cycles` - List available game cycles

#### Gameplay

- `GET /api/match/next` - Get next opponent (real or bot)
- `POST /api/chat/send` - Send message (relay or generate bot response)
- `GET /api/chat/poll` - Poll for new messages
- `POST /api/vote/submit` - Submit guess & record vote
- `GET /api/leaderboard/current` - Get current rankings

### Repository Structure

```
detective/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Home/landing
│   │   ├── page.tsx                   # Landing page
│   │   └── api/
│   │       ├── game/
│   │       │   ├── register/route.ts  # POST: Register user
│   │       │   ├── status/route.ts    # GET: Game state
│   │       │   └── cycles/route.ts    # GET: List game cycles
│   │       ├── match/
│   │       │   └── next/route.ts      # GET: Get next opponent
│   │       ├── chat/
│   │       │   ├── send/route.ts      # POST: Send message (relays or generates)
│   │       │   └── poll/route.ts      # GET: Poll for new messages
│   │       ├── vote/
│   │       │   └── submit/route.ts    # POST: Submit guess
│   │       └── leaderboard/
│   │           └── current/route.ts   # GET: Leaderboard for active game
│   ├── components/
│   │   ├── GameRegister.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── VotingPanel.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── Timer.tsx
│   │   └── GameStatus.tsx
│   ├── lib/
│   │   ├── gameState.ts               # In-memory state (Map-based)
│   │   ├── neynar.ts                  # Neynar API calls
│   │   ├── inference.ts               # Venice AI (OpenAI SDK-compatible)
│   │   ├── types.ts                   # TypeScript types
│   │   └── utils.ts                   # Helpers
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
└── README.md
```

---

## Key Design Decisions

1. **No Database**: Game state in-memory (50 players = ~1-2 MB RAM). Acceptable for MVP.
2. **HTTP Polling**: Simpler than WebSocket for 50 concurrent users.
3. **Neynar Score > 0.8**: Filters out bots and low-quality accounts upfront.
4. **Venice AI (Llama 3.3 70B)**: Privacy-first inference with strong impersonation quality.
5. **Vercel Free Tier**: Sufficient for MVP load and cost constraints.

### Why This Works for Farcaster

- **Social Discovery**: Users learn about others through conversation
- **Creator Incentives**: Engagement metrics drive visibility
- **On-Platform**: Mini app lives entirely in Warpcast feed
- **Viral Loop**: Leaderboard displays naturally within casts

---

## Feasibility Assessment

### ✅ Highly Feasible (Low Risk)

1. **User Authentication** - Farcaster SDK mature & battle-tested
2. **Content Scraping** - Neynar quality filtering (score > 0.8) reduces abuse
3. **Chat UI** - Standard React components, no complex state
4. **In-Memory Game State** - 50 players = ~1-2 MB RAM footprint, negligible
5. **Next.js Deployment** - Vercel free tier handles this easily
6. **HTTP Polling** - Simple, proven pattern for real-time chat

### ⚠️ Moderate Risk (Manageable)

1. **AI Bot Believability** - Requires prompt engineering & user testing
   - _Mitigation_: Start with Venice defaults, iterate on feedback per cycle
2. **Neynar Free Tier (10k req/day)** - Ample for 50 players (~200 reqs/game)
   - _Mitigation_: Batch scraping, cache responses, monitor costs
3. **Venice AI Cost** - low per-game cost at this scale
   - _Mitigation_: Acceptable MVP cost; monitor token usage

### 🟢 Very Low Risk

1. **Farcaster Mini App Ecosystem** - Production-ready as of 2025
2. **User Privacy** - Only scraping public posts; add disclaimer in signup
3. **Game State Loss** - Acceptable for MVP (restart game cycle if service fails)

---

## Success Metrics & Launch Criteria

### MVP Playable Criteria (Phase 1, ~1 week)

- [ ] Game registers 2-3 test users via Farcaster SDK
- [ ] Neynar score filter works (rejects score < 0.8)
- [ ] Chat works: real user messages relay properly
- [ ] Bot responses generate via Venice AI
- [ ] Voting & leaderboard calculate correctly (in-memory)
- [ ] No crashes during 30-minute test session

### Phase 2 Polish Criteria (~1 week)

- [ ] Bot responses feel "human-like" (5-10 testers, subjective feedback)
- [ ] Venice costs tracked (~$1-2 per test game)
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
