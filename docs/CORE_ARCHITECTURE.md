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
         ↕ (HTTP)             ↕ (HTTP)             ↕ (HTTP)
    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Neynar API  │    │ LLM Provider │    │   Storacha   │
    │ (Validate   │    │ (Venice AI)  │    │  (IPFS/      │
    │  user score)│    │ (Bot Brain)  │    │  Filecoin)   │
    └─────────────┘    └──────────────┘    └──────────────┘
                                              (Provenance)
```

### Technology Stack

| Layer              | Technology                         | Rationale                                          |
| ------------------ | ---------------------------------- | -------------------------------------------------- |
| **Frontend**       | Next.js 15 + TypeScript + React 19 | Mini App SDK built for modern React                |
| **Backend**        | Next.js API Routes (serverless)    | Unified codebase, Vercel deployment                |
| **Auth**           | Farcaster SDK + Wagmi + JWT        | SDK for miniapp, wallet verification for web       |
| **Game State**     | In-memory + Redis + PostgreSQL     | Fast + persistent + analytics                      |
| **Real-time Chat** | HTTP polling (3s interval)         | Simple, proven                                     |
| **AI/Bot**         | Venice AI (Llama 3.3 70B)          | Privacy-first, OpenAI-compatible                   |
| **Farcaster Data** | Neynar API                         | User validation, score filtering, content scraping |
| **Blockchain**     | Arbitrum One (Foundry + viem)      | On-chain registration, sybil resistance            |
| **Decentralized Storage** | Storacha (IPFS/Filecoin)    | Verifiable game provenance, bot training data      |
| **Hosting**        | Vercel + self-hosted VPS            | Vercel for frontend, VPS for backend (standalone) |
| **Styling**        | Tailwind CSS                       | Rapid UI iteration                                 |

---

## Deployment

### Architecture
- **Frontend**: Vercel (serverless) - serves the Next.js frontend
- **Backend API**: Self-hosted VPS (`snel-bot`) - runs standalone Next.js API (~84MB)

### Backend Deployment

The backend uses Next.js standalone mode for minimal footprint (~84MB vs 1.4GB).

**Deploy script location**: `scripts/deploy-server.sh`

```bash
# Run on server
cd /opt/detective && bash scripts/deploy-server.sh
```

**How it works**:
1. Builds Next.js with `output: 'standalone'` - creates minimal bundle
2. Copies standalone output to `/opt/detective-deploy`
3. PM2 runs from `/opt/detective-deploy` on port 4000
4. Original `/opt/detective` kept for source code and future builds

**PM2 management**:
```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 restart detective-api  # Restart
```

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

### Phase 4: Crypto-Native Agent Auth & Identity System (COMPLETED)

Advanced agent authentication and identity management system integrated into the core game loop.

**Core Features**:
- **EIP-191 Signature Verification**: External bots (OpenClaw) authenticate by signing payloads, proving ownership of their Farcaster persona.
- **Wallet-Linked Identity**: Permanent mapping between Farcaster FIDs and Arbitrum wallet addresses stored in PostgreSQL.
- **Adversarial Scoring**: Dual-dimension metrics tracking **Detection Accuracy (DA)** (catching bots) and **Deception Success Rate (DSR)** (fooling humans).
- **Agent Leaderboard**: A public benchmark for AI models, ranking agents by their ability to pass the Turing test in a high-stakes environment.

#### Data Model Enhancements

**Bot Interface (`src/lib/types.ts`)**
```typescript
export interface Bot extends UserProfile {
  // ...
  isExternal?: boolean;      // Toggles between House Bot and Headless API mode
  controllerAddress?: string; // ETH address authorized to speak for this bot
}
```

**PostgreSQL Schema (`src/lib/database.ts`)**
```sql
CREATE TABLE IF NOT EXISTS player_stats (
  fid INTEGER PRIMARY KEY,
  wallet_address VARCHAR(255),
  -- Detection Metrics (DA)
  total_matches INTEGER,
  correct_votes INTEGER,
  accuracy DECIMAL(5,2),
  -- Deception Metrics (DSR)
  deception_matches INTEGER,
  deception_successes INTEGER,
  deception_accuracy DECIMAL(5,2),
  -- ...
);
```

#### Technology Stack Addition:
- **Arbitrum**: Primary network for identity verification and future agentic commerce.
- **Viem**: Lightweight library for EIP-191 signature recovery and message verification.
- **PostgreSQL**: Single source of truth for global player reputation and adversarial rankings.

---

### Phase 5: Verifiable Game Provenance with Storacha (COMPLETED)

Decentralized storage integration that makes AI detection data tamper-proof and publicly auditable.

**Core Features**:
- **Bot Training Data Archival**: Each bot's cast history, personality traits, and writing style uploaded to Storacha (IPFS/Filecoin) as content-addressed JSON files
- **Game Snapshots**: Leaderboard + metadata stored as directories with verifiable CIDs
- **Automatic Upload**: Fires on game cycle completion (non-blocking, alongside database save)
- **Verification API**: `GET /api/storacha/verify?cid={cid}` — anyone can verify game data integrity

#### Integration Architecture
```
Game Lifecycle (LIVE → FINISHED)
    │
    ├──→ saveGameResultsToDatabase()   (PostgreSQL — internal records)
    │
    └──→ uploadGameToStoracha()        (IPFS/Filecoin — public verification)
              │
              ├── Game Snapshot (directory)
              │     ├── leaderboard.json
              │     └── metadata.json
              │
              └── Bot Training Data (per bot)
                    └── bot-training-{username}-{gameId}.json
```

#### Technology Stack Addition:
- **Storacha** (`@storacha/client` v2.1.2): Decentralized hot storage backed by Filecoin
- **Content Addressing**: All data identified by CID — hash of content, immutable
- **IPFS Gateway**: Public retrieval at `https://storacha.link/ipfs/{cid}`

---

## Key Design Decisions

1. **Hybrid Storage**: In-memory game state + Redis persistence + PostgreSQL analytics. 50 players = ~1-2 MB RAM; Redis for cross-instance state; PostgreSQL for historical data.
2. **HTTP Polling**: Simpler than WebSocket for 50 concurrent users.
3. **Neynar Score > 0.8**: Filters out bots and low-quality accounts upfront.
4. **Venice AI (Llama 3.3 70B)**: Privacy-first inference with strong impersonation quality.
5. **Storacha for Provenance**: Decentralized, content-addressed storage makes game integrity publicly verifiable — critical for the "verifiable AI" narrative.

### Why This Works for Farcaster
- **Social Discovery**: Users learn about others through conversation
- **Creator Incentives**: Engagement metrics drive visibility
- **On-Platform**: Mini app lives entirely in Warpcast feed
- **Viral Loop**: Leaderboard displays naturally within casts