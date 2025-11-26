# Detective Core Architecture & Development

## Executive Summary

Detective is an AI-powered social deduction game on Farcaster. Players engage in conversations and guess whether they're speaking with real users or AI bots trained on players' writing styles.

### Core Concept
- **Game Type**: Social deduction game on Farcaster
- **Objective**: Guess if chatting with real person or AI bot
- **Innovation**: AI bots trained on real Farcaster users' posts
- **Platform**: Farcaster mini app (Warpcast native)

### Constraints & Design Philosophy
- **Max 50 concurrent players** per game cycle
- **Neynar Quality Filter**: Score > 0.8 (ensures quality participants)
- **No database required initially**: Game state in memory
- **Simple deployment**: Vercel serverless functions

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
| **Real-time Chat** | HTTP polling (3s interval)         | Simple, proven                                     |
| **AI/Bot**         | Venice AI (Llama 3.3 70B)          | Privacy-first, OpenAI-compatible                   |
| **Farcaster Data** | Neynar API                         | User validation, score filtering, content scraping |
| **Hosting**        | Vercel                             | Free tier sufficient for this load                 |
| **Styling**        | Tailwind CSS                       | Rapid UI iteration                                 |

---

## Game Mechanics

### Core Loop
1. **Registration**: Users opt-in via Farcaster mini app, system validates quality via Neynar
2. **Game Live**: Users paired with real users (50%) or AI bots (50%) for 4-minute chats
3. **Voting**: Users guess "Real Person" or "Bot" after conversation
4. **Scoring**: Accuracy calculated with speed tiebreaker, leaderboard generated

### Registration Requirements
- Users must have Neynar score > 0.8 (filters bots/low-quality accounts)
- Hard cap: 50 players per cycle
- System scrapes 30 recent casts per user for bot training

### Match Mechanics
- **Duration**: 4 minutes per match (configurable)
- **Rounds**: 5 matches per player per cycle
- **Assignment**: 50% real users, 50% bots in random assignment
- **Message Exchange**: HTTP polling (3s interval)

### Bot Intelligence
**AI Model**: Venice AI (Llama 3.3 70B) via OpenAI SDK-compatible client

**Training Data**:
- Username, display name, top 30 recent casts
- Inferred writing style (tone, length, emoji usage, capitalization)
- Cast-pattern personality analysis

**Proactive Behavior**:
- Bots can initiate conversations based on user's actual patterns
- If user frequently posts "gm" → bot might say "gm" first (30-50% chance)
- Uses their ACTUAL phrases, not templates

**Response Generation**:
- System prompt includes communication traits
- Constraint: Stay under 240 characters (Farcaster limit)
- Never acknowledge being an AI

### Voting & Scoring
- After each match: Guess "Real" or "Bot"
- Accuracy calculated per user: (Correct Guesses / Total Guesses) × 100
- Tiebreaker: Speed of correct answers
- Leaderboard sorted by accuracy then speed

---

## Development Phases

### Phase 1: MVP Foundation (1-2 weeks)
**Goal**: Core game loop works, single game cycle, no database

#### Project Setup
- Initialize `create-next-app` with TypeScript
- Install @farcaster/miniapp-sdk, Neynar SDK, OpenAI SDK
- Setup environment variables (.env.local)
- Configure Vercel deployment

#### Farcaster Integration
- Implement Mini App manifest
- User authentication flow (Farcaster SDK)
- Retrieve user profile (FID, username, pfp)
- List available game cycles (hardcoded initially)

#### Game Registration with Quality Gate
- Registration UI (simple form with "Join" button)
- Quality filter: Call Neynar to validate Farcaster score > 0.8
- Reject if score too low (graceful error)
- Hard cap at 50 registrants per cycle
- Store in-memory: `registeredUsers: Map<FID, UserProfile>`

#### Chat Interface (HTTP Polling)
- 2-column layout: Messages + opponent responses
- Fake bot responses (Venice AI with hardcoded context initially)
- 4-minute timer countdown
- Real user-to-user messaging via polling (/api/chat/poll)

#### Voting & Basic Scoring
- Vote submission endpoint (/api/vote/submit)
- Calculate accuracy per match (in-memory)
- Simple leaderboard view (computed from in-memory scores)

**Output**: Playable game with Venice bot, working leaderboard, no database

### Phase 2: AI Integration & Polish (1 week)
**Goal**: Venice bots feel authentic, game is fun

#### Prompt Engineering
```
You are @${username}. You recently wrote these posts:
${recentCasts}

Your style: ${toneSummary}
Keep responses under 240 chars. Stay in character.
Never say you're AI. Respond naturally.
```

#### Bot Response Generation
- Implement `/api/chat/send` (handles both users & bots)
- Route to Venice AI if opponent is bot
- Add response caching (same question → cached response)

#### User Testing
- Recruit 5-10 Farcaster beta users
- 1-2 game cycles (3-4 hour sessions)
- Collect feedback on bot believability

**Output**: Believable bots, polished MVP, ready for soft launch

### Phase 3: Multi-Game Support (1 week, post-soft-launch)
**Goal**: Run repeated game cycles, measure retention

#### Game Lifecycle Management
- Simple admin interface to define game cycles
- Cycle state machine: `REGISTRATION` → `LIVE` → `FINISHED`
- Hardcoded initially, can add UI later

#### In-Memory State Persistence
- Consider Vercel KV for multi-instance sync
- Export final leaderboard as JSON
- Allow users to cast leaderboard results

---

## Scaling Guide

### Single Server (Development)
```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Server                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           GameManager (In-Memory Singleton)             ││
│  │  • players: Map<fid, Player>                            ││
│  │  • bots: Map<fid, Bot>                                  ││
│  │  • matches: Map<matchId, Match>                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```
**Limits:** ~50-100 concurrent players, single server only

### Horizontally Scaled (Production)
```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     ┌─────────┐     ┌─────────┐     ┌─────────┐
     │ Server 1│     │ Server 2│     │ Server 3│
     └────┬────┘     └────┬────┘     └────┬────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    ┌───────────┐
                    │   Redis   │ (Shared State)
                    │  Cluster  │
                    └─────┬─────┘
                          │
                    ┌─────┴─────┐
                    │ PostgreSQL│ (Persistence)
                    └───────────┘
```
**Limits:** 1000+ concurrent players, unlimited horizontal scaling

### Environment Variables
```env
# API Keys
NEYNAR_API_KEY=xxx          # Farcaster user data
VENICE_API_KEY=xxx          # Bot AI responses
ABLY_API_KEY=xxx            # WebSocket

# Redis (for horizontal scaling)
REDIS_URL=redis://xxx
USE_REDIS=true

# PostgreSQL (for persistence)
DATABASE_URL=postgresql://xxx
USE_DATABASE=true

# WebSocket
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

### Performance Optimization
- **Bot Response Caching**: Pre-generate responses during registration
- **Shared Ably Channels**: Use for >20 players (more efficient)
- **Database Indexing**: Add indexes for common queries
- **Connection Pooling**: Redis and database connection optimization

### Cost Estimation
| Service | Free Tier | Estimated Cost at Scale |
|---------|-----------|------------------------|
| Vercel | 100GB bandwidth | $20/mo (Pro) |
| Upstash Redis | 10K commands/day | $10/mo (Pay-as-you-go) |
| Neon PostgreSQL | 3GB storage | $19/mo (Launch) |
| Ably | 200 connections | $29/mo (Standard) |

**Estimated Monthly Cost:**
- **Small (< 100 users):** $0 (free tiers)
- **Medium (100-500 users):** ~$50-80/mo
- **Large (500-2000 users):** ~$150-300/mo

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

This architecture provides a solid foundation for scaling from MVP to production while maintaining the core Farcaster-native experience.