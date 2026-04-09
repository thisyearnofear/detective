# Detective Architecture

AI-powered social deduction game on Farcaster. Players chat with opponents and guess: Human or AI?

## System Architecture

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

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 15 + TypeScript + React 19 | Mini App SDK built for modern React |
| **Backend** | Next.js API Routes (serverless) | Unified codebase, Vercel deployment |
| **Auth** | Farcaster SDK + Quick Auth + JWT | SDK for miniapp, edge-deployed JWT tokens |
| **Game State** | In-memory + Redis + PostgreSQL | Fast + persistent + analytics |
| **Real-time Chat** | HTTP polling (3s interval) | Simple, proven for 50 concurrent users |
| **AI/Bot** | Venice AI (Llama 3.3 70B) | Privacy-first, OpenAI-compatible |
| **Farcaster Data** | Neynar API | User validation, score filtering, cast scraping |
| **Blockchain** | Arbitrum One (Foundry + viem) | On-chain registration, sybil resistance |
| **Storage** | Storacha (IPFS/Filecoin) | Verifiable game provenance |
| **Hosting** | Vercel + self-hosted VPS | Vercel for frontend, VPS for backend (PM2) |

## Deployment Architecture

**Frontend**: Vercel (serverless) - serves Next.js frontend
**Backend API**: Self-hosted VPS - runs standalone Next.js API (~84MB via PM2)

### Backend Deployment

```bash
# Deploy script location: scripts/deploy-server.sh
cd /opt/detective && bash scripts/deploy-server.sh
```

**How it works**:
1. Builds Next.js with `output: 'standalone'` - creates minimal bundle
2. Copies standalone output to `/opt/detective-deploy`
3. PM2 runs from `/opt/detective-deploy` on port 4000

**PM2 management**:
```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 restart detective-api  # Restart
```

## Game Modes

Detective supports multiple game modes, configurable per game cycle.

### Mode 1: Conversation (Default)

Players chat with opponents and guess: Human or AI?

### Core Loop
1. **Registration**: Users opt-in via Farcaster mini app, validated via Neynar (score > 0.8)
2. **Match**: Players paired with real users (50%) or AI bots (50%) for 4-minute chats
3. **Voting**: Players guess "Real Person" or "Bot" after conversation
4. **Scoring**: Accuracy calculated with speed tiebreaker, leaderboard generated

### Registration Requirements
- Neynar score > 0.8 (filters bots/low-quality accounts)
- Hard cap: 50 players per cycle
- System scrapes 30 recent casts per user for bot training

### Match Mechanics
- **Duration**: 4 minutes per match (configurable)
- **Rounds**: 5 matches per player per cycle
- **Assignment**: 50% real users, 50% bots in random assignment

### Bot Intelligence

**AI Model**: Venice AI (Llama 3.3 70B) via OpenAI SDK-compatible client

**Training Data**:
- Username, display name, top 30 recent casts
- Inferred writing style (tone, length, emoji usage, capitalization)
- Cast-pattern personality analysis (20+ behavioral traits)

**Proactive Behavior**:
- Bots can initiate conversations based on user's actual patterns
- If user frequently posts "gm" → bot might say "gm" first (30-50% chance)
- Uses their ACTUAL phrases, not templates

**Response Generation**:
- System prompt includes communication traits
- Constraint: Stay under 240 characters (Farcaster limit)
- Never acknowledge being an AI
- Realistic typing delays (2-7s, personality-dependent)
- Cross-round memory via Lite Redis-backed context

### Voting & Scoring
- After each match: Guess "Real" or "Bot"
- Accuracy calculated per user: (Correct Guesses / Total Guesses) × 100
- Tiebreaker: Speed of correct answers
- Leaderboard sorted by accuracy then speed

### Mode 2: Negotiation

Players negotiate resource splits with AI opponents over 5 rounds.

**Resources**: Books, Hats, Balls (2-4 of each per match)
- Hidden valuations: 2, 4, 6, 8, or 10 points per unit
- Goal: Maximize your score by getting high-value items

**Actions**:
1. **Propose**: Offer a resource split (must sum to pool)
2. **Accept**: Accept current proposal (ends match)
3. **Reject**: Reject and continue negotiating

**Scoring**:
- Deal reached: Normalized score 0.0–1.0 based on your valuation
- No deal: -0.5 penalty for both players
- 5 rounds maximum, 1 minute per round, auto-timeout

**Bot Strategy**: LLM-powered with behavioral economics tactics (anchoring, framing, reciprocity, loss aversion, urgency). Falls back to heuristic if LLM unavailable.

**API**: `POST /api/negotiation/action` with `{ matchId, action, message, proposal? }`

**UI Components**: `ModeSelector` (mode display/selection), `NegotiationInterface` (resource sliders, proposal builder, score preview, action buttons, round history).

**Type Guards**: `isNegotiationMatch(match)`, `calculateMatchScore(match)`, `validateProposal(myShare, theirShare, pool)` — all in `src/lib/gameMode.ts`.

**Backward Compatibility**: `Match.mode` is optional (defaults to `'conversation'`). Mode can be switched between games, not mid-game. All existing APIs remain unchanged.

**Admin**: Set mode via `POST /api/admin/state` with `{ action: "update-config", config: { mode: "negotiation" } }`.

## Advanced Features

### Phase 4: Crypto-Native Agent Auth & Identity

**Core Features**:
- **EIP-191 Signature Verification**: External bots authenticate by signing payloads
- **Wallet-Linked Identity**: Permanent mapping between Farcaster FIDs and Arbitrum wallets
- **Adversarial Scoring**: Dual metrics - Detection Accuracy (DA) and Deception Success Rate (DSR)
- **Agent Leaderboard**: Public benchmark for AI models

**Bot Interface**:
```typescript
export interface Bot extends UserProfile {
  isExternal?: boolean;      // House Bot vs Headless API mode
  controllerAddress?: string; // ETH address authorized to speak for this bot
}
```

**PostgreSQL Schema**:
```sql
CREATE TABLE IF NOT EXISTS player_stats (
  fid INTEGER PRIMARY KEY,
  wallet_address VARCHAR(255),
  total_matches INTEGER, correct_votes INTEGER, accuracy DECIMAL(5,2),
  deception_matches INTEGER, deception_successes INTEGER, deception_accuracy DECIMAL(5,2)
);
```

### Phase 5: Verifiable Game Provenance (Storacha)

**Core Features**:
- **Bot Training Data Archival**: Cast history, personality traits uploaded as content-addressed JSON
- **Game Snapshots**: Leaderboard + metadata stored as directories with verifiable CIDs
- **Automatic Upload**: Fires on game cycle completion (non-blocking)
- **Verification API**: `GET /api/storacha/verify?cid={cid}` — anyone can verify data integrity

**Integration**:
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

### Phase 6: World ID 4.0 Integration

**Core Features**:
- **RP Signatures**: Server-side signature generation for secure verification requests
- **v4 Verification API**: Uses `/api/v4/verify/{rp_id}` endpoint
- **Backward Compatibility**: Accepts both v3 and v4 proofs via `allow_legacy_proofs`

**Flow**:
```
User clicks "Verify with World ID"
    │
    ├─→ Fetch RP context: GET /api/auth/world-id/rp-context?action=play-detective
    │       └─→ Server signs request with RP Signing Key
    │
    ├─→ IDKit opens with rp_context (rp_id, nonce, signature, timestamps)
    │
    ├─→ User completes orb/selfie verification in World App
    │
    └─→ Post verification: POST /api/auth/world-id/verify
            └─→ Forward to https://developer.world.org/api/v4/verify/{rp_id}
```

**Environment Variables**:
```env
NEXT_PUBLIC_WORLD_APP_ID=app_xxxxxxxx
NEXT_PUBLIC_WORLD_RP_ID=rp_xxxxxxxx
WORLD_RP_SIGNING_KEY=0x...
```

## Key Design Decisions

1. **Hybrid Storage**: In-memory game state + Redis persistence + PostgreSQL analytics
2. **HTTP Polling**: Simpler than WebSocket for 50 concurrent users
3. **Neynar Score > 0.8**: Filters out bots and low-quality accounts upfront
4. **Venice AI (Llama 3.3 70B)**: Privacy-first inference with strong impersonation quality
5. **Storacha for Provenance**: Decentralized, content-addressed storage makes game integrity publicly verifiable
6. **World ID for Sybil Resistance**: Additional layer of human verification

## Farcaster Mini App Integration

1. **Manifest**: `/public/.well-known/farcaster.json` - app metadata
2. **SDK**: `@farcaster/miniapp-sdk` handles native features
3. **Ready Signal**: `sdk.actions.ready()` called on app load
4. **Authentication**: Quick Auth integrated with Mini App environment

## Costs

**Per game cycle** (50 players, 5 rounds = 250 bot responses):
- Neynar API: Free tier (10k req/day limit, we use ~200)
- Venice AI: ~$0.75 (250 responses × $0.003/response)
- Vercel: Free tier
- **Total: <$1 per game**
