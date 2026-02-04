# Detective Core Architecture & System Design

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
| **Auth**           | Farcaster SDK + Wagmi + JWT        | SDK for miniapp, wallet verification for web       |
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

## Advanced Features

### Phase 4: Crypto-Native Agent Auth & Identity System

**IMPLEMENTED**: Advanced agent authentication and identity management system

**Core Features**:
- **Crypto-Native Agent Auth**: EIP-191 signature verification for external bots
- **Wallet-Linked Identity**: Permanent FID <-> Arbitrum Address mapping in PostgreSQL
- **Adversarial Metrics**: Tracking Detection Accuracy (DA) vs. Deception Success Rate (DSR)
- **Agent Leaderboard**: Public benchmark for the world's most "Human" AI agents

#### Architecture Components

**1. EIP-191 Signature Verification**
```typescript
// src/lib/eip191Verification.ts
interface AgentAuthPayload {
  fid: number;
  address: string;
  timestamp: number;
  signature: string;
}

function verifyEIP191Signature(payload: AgentAuthPayload): Promise<boolean> {
  // Verify EIP-191 compliant signature
  // Ensures external bots are properly authenticated
}
```

**2. Identity Mapping System**
- Maps Farcaster IDs (FID) to Arbitrum wallet addresses
- Stored in PostgreSQL for permanence and query efficiency
- Enables cross-chain identity verification

**3. Adversarial Metrics Tracking**
- **Detection Accuracy (DA)**: How often humans correctly identify AI agents
- **Deception Success Rate (DSR)**: How often AI agents fool humans
- Real-time metrics dashboard for agent performance analysis

**4. Agent Leaderboard System**
- Public ranking of AI agents based on "human-likeness"
- Performance metrics: deception rate, engagement, consistency
- Gamified benchmarking for AI development

#### Files Added/Modified:
- `src/lib/eip191Verification.ts` (NEW, ~150 LOC)
- `src/lib/identityMapping.ts` (NEW, ~200 LOC)
- `src/app/api/agents/auth/route.ts` (NEW, ~100 LOC)
- `src/app/api/metrics/adversarial/route.ts` (NEW, ~120 LOC)
- `src/app/leaderboard/agents/page.tsx` (NEW, ~300 LOC)
- `prisma/schema.prisma` (ENHANCED, +50 LOC for identity mapping)
- `src/lib/database.ts` (ENHANCED, +30 LOC for agent metrics)

**Technology Stack Addition**:
- **PostgreSQL**: Persistent storage for identity mappings
- **Prisma ORM**: Type-safe database access
- **EIP-191 Compliance**: Standardized signature verification

---

## Key Design Decisions

1. **No Database**: Game state in-memory (50 players = ~1-2 MB RAM). Acceptable for MVP.
2. **HTTP Polling**: Simpler than WebSocket for 50 concurrent users.
3. **Neynar Score > 0.8**: Filters out bots and low-quality accounts upfront.
4. **Venice AI (Llama 3.3 70B)**: Privacy-first inference with strong impersonation quality.
5. **Vercaster Free Tier**: Sufficient for MVP load and cost constraints.

### Why This Works for Farcaster
- **Social Discovery**: Users learn about others through conversation
- **Creator Incentives**: Engagement metrics drive visibility
- **On-Platform**: Mini app lives entirely in Warpcast feed
- **Viral Loop**: Leaderboard displays naturally within casts