# PL Genesis: Frontiers of Collaboration — Hackathon Submission

## Project: Detective

**AI-powered social deduction game on Farcaster — Can you tell if you're chatting with a human or an AI?**

---

## Tracks & Bounties Applied

| Track | Category | Status |
|---|---|---|
| **Existing Code** ($5K × 10 teams) | Competition Track | Applied |
| **AI, AGI & Robotics** | Focus Area | Applied |
| **Crypto & Decentralized Economies** | Focus Area | Applied |
| **Storacha Bounty** | Sponsor Challenge | Integrated |
| **Crecimiento Track** | Sponsor Challenge | Applied |

---

## The Problem

AI models are becoming indistinguishable from human behavior. As LLMs become more sophisticated, the ability to detect AI-generated content becomes a critical infrastructure problem — for content moderation, sybil resistance, and trust in digital interactions.

## The Solution

Detective turns this detection challenge into a **verifiable, measurable game**:

1. **AI Agents** are trained on real Farcaster users' public cast history (personality, writing style, tone)
2. **Players** chat with opponents in real-time and guess: **Human or AI?**
3. **Scores** are calculated on-chain with verifiable game provenance stored on **Storacha** (IPFS/Filecoin)

## Technical Highlights

### Farcaster-Native (Production Ready)
- **Mini App SDK** (`@farcaster/miniapp-sdk` v0.2.1) — runs natively in Warpcast
- **Quick Auth** — edge-deployed JWT tokens, zero API key overhead
- **Neynar Integration** — quality-score gating (>0.8), cast scraping for bot training

### On-Chain Game Mechanics (Arbitrum)
- **Smart Contract**: `DetectiveGameEntry.sol` deployed on **Arbitrum One**
  - Address: `0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460`
  - Verified: [Blockscout](https://arbitrum.blockscout.com/address/0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460)
  - Features: `registerForGame()`, `setMinEntryFee()`, `setPause()`, event logging
- **Sybil Resistance**: One-shot registration per wallet per cycle
- **Entry Fees**: Native ETH/ARB staking (0.0001–0.1 ETH) or USDC (1–100 USDC)

### Verifiable AI Provenance (Storacha — Sponsor Integration)
- **Bot Training Data**: Each bot's cast history + personality profile uploaded to **Storacha** decentralized storage
- **Game Snapshots**: Leaderboard + metadata stored as content-addressed directories on IPFS/Filecoin
- **Match Provenance**: Verifiable record of each match (votes, timing, LLM model used)
- **Retrievable**: Any game data verifiable via CID at `https://storacha.link/ipfs/{cid}`

### Multi-LLM Intelligence
- **Venice AI** (Llama 3.3 70B) — primary bot intelligence
- **OpenRouter** — multi-model support (Claude Haiku, Gemini Flash, etc.)
- **Personality-aware**: 20+ behavioral traits extracted from cast history
- **Realistic timing**: Thinking delays, typing pauses, message length variance

---

## Sponsor Bounty: Storacha Integration

**Why Storacha**: Detective's core value proposition is verifiable AI detection. Storacha provides the decentralized, content-addressed storage layer that makes game provenance tamper-proof and publicly auditable.

### What Gets Stored

| Data Type | Format | Purpose |
|---|---|---|
| Bot Training Data | JSON per bot | Proves which casts trained each AI |
| Game Snapshots | Directory (leaderboard + metadata) | Verifiable game integrity |
| Match Provenance | JSON per match | Immutable record of each human-vs-AI encounter |

### Integration Points

1. **Automatic on game finish**: `uploadGameToStoracha()` fires when a game cycle ends (non-blocking)
2. **API endpoint**: `POST /api/storacha/upload-training-data` for manual uploads
3. **Verification endpoint**: `GET /api/storacha/verify?cid={cid}` for data retrieval

### Setup

```bash
# Install CLI and authenticate
npm install -g @storacha/cli
storacha login your@email.com
storacha space create detective-game

# Enable in .env.local
STORACHA_ENABLED=true
STORACHA_SPACE_DID=did:key:your_space_did_here
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              FARCASTER CLIENT (Warpcast)                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Detective Mini App (Next.js in WebView)               │  │
│  │  - Quick Auth via Farcaster SDK                        │  │
│  │  - Real-time chat UI / voting interface                │  │
│  │  - Leaderboard / profile                               │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/SSE
┌───────────────────────────▼─────────────────────────────────┐
│              BACKEND API (Next.js API Routes)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Game State Manager (in-memory + Redis persistence)    │  │
│  │  - Registration, matching, chat relay, voting          │  │
│  │  - Bot AI with personality-aware responses             │  │
│  │  - Multi-chain leaderboard engine                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──┬──────────────┬──────────────┬──────────────┬─────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐
│ Neynar │  │ Venice   │  │ Arbitrum │  │  Storacha  │
│  API   │  │ AI API   │  │ Contract │  │  (IPFS)    │
│(users) │  │ (bots)   │  │ (staking)│  │ (provenance│
└────────┘  └──────────┘  └──────────┘  └────────────┘
```

## Cost Model

**Per game cycle** (50 players, 5 rounds = 250 bot responses):
- Neynar API: Free tier (~200 requests)
- Venice AI: ~$0.75 (250 responses × $0.003)
- Storacha: Free tier (included in plan)
- Vercel: Free tier
- **Total: <$1 per game**

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/storacha.ts` | Storacha SDK integration |
| `src/lib/gameState.ts` | Core game logic + Storacha upload hook |
| `src/lib/botBehavior.ts` | Bot personality + typing behavior |
| `src/lib/neynar.ts` | Farcaster user data + quality gating |
| `contracts/src/DetectiveGameEntry.sol` | Arbitrum entry contract |
| `src/app/api/storacha/` | Storacha API routes |

---

## Links

- **GitHub**: [github.com/thisyearnofear/detective](https://github.com/thisyearnofear/detective)
- **Contract**: [arbiscan.io/address/0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460](https://arbiscan.io/address/0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460)
- **Farcaster Channel**: [warpcast.com/~/channel/detective](https://warpcast.com/~/channel/detective)
- **PL Genesis**: [plgenesis.com](https://www.plgenesis.com)
