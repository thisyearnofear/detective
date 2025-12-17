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
- User authentication flow:
  - **Farcaster miniapp**: SDK auto-authentication
  - **Web/mobile**: Wallet connection (wagmi) → verify Farcaster profile via Neynar
  - JWT tokens (7-day expiry) for session management
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

# Redis (REQUIRED - Upstash REST API)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# PostgreSQL (REQUIRED - for persistence)
DATABASE_URL=postgresql://xxx
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

## Recent Architecture Changes

Based on recent development efforts, the following architectural improvements have been implemented to enhance the system's reliability and user experience:

### 1. Server-Driven Game Phase Transitions

**Problem**: BriefingRoom had `setTimeout` delays that could drift from server state, causing frozen UI.

**Solution**: New `/api/game/phase` endpoint returns current phase + metadata with server-driven state management.

**Implementation Details**:
- BriefingRoom polls `/api/game/phase` every 1s instead of using client-side timeouts
- Endpoint returns: `phase: 'REGISTRATION' | 'BOT_GENERATION' | 'PLAYER_REVEAL' | 'COUNTDOWN' | 'LIVE'`
- Auto-transitions based on server response (not client timer)
- Handles network failures gracefully with ErrorCard display

**Benefits**:
- No more client-server state drift
- Server is source of truth for phase transitions
- Handles network failures gracefully
- Clear debugging via `reason` field in response

### 2. Centralized Modal Management System

**Problem**: Overlays (reveal screen, errors, loading) had no centralized management, causing z-index conflicts and confusion.

**Solution**: ModalStack context provider with automatic layering and proper state management.

**Implementation Details**:
- Single source of truth for all overlays using React context
- Automatic z-index calculation (50 + index*10)
- Backdrop click to dismiss top modal
- Auto-close timers with configurable durations
- Proper component mounting/unmounting lifecycle

**Benefits**:
- No overlay conflicts or z-index issues
- Automatic layering with proper precedence
- Consistent modal behavior across the application
- Built-in auto-close support for timed modals

### 3. Consolidated Loading System

**Problem**: RegistrationLoader + RoundStartLoader were nearly identical (90% code duplication).

**Solution**: Single LoadingOverlay component with variants and flexible rendering.

**Implementation Details**:
- Supports 5 variants: `registration`, `round-start`, `preparing`, `reveal`, `generic`
- Configurable progress bars and messages
- Both inline and fixed positioning modes
- Replaced both duplicate components

**Benefits**:
- Eliminates code duplication
- Consistent loading experience across the app
- Easier maintenance and updates
- Flexible rendering options

### 4. Centralized Countdown Timer System

**Problem**: Multiple countdown timers scattered across components with different logic.

**Solution**: Custom `useCountdown` hook with consistent interface and server time sync.

**Implementation Details**:
- Returns: `timeRemaining`, `secondsRemaining`, `isExpired`, `formattedTime`, `percentRemaining`
- Configurable poll interval (defaults to 100ms for smooth updates)
- Syncs with server time via timeOffset
- Handles onComplete callback consistently

**Benefits**:
- Single source of truth for all timers
- Smooth 100ms updates (not jerky 1s updates)
- Server time sync via timeOffset
- Easy to add warning states based on secondsRemaining

### 5. Enhanced Vote Toggle System

**Problem**: Users didn't know when their vote would lock, creating poor UX under time pressure.

**Solution**: Three-tier warning system in VoteToggle with visual feedback.

**Implementation Details**:
- **Normal (> 10s)**: Hint text: "↑ Click to change your vote"
- **Warning (3-10s)**: Yellow alert: "⚠️ 10 seconds to lock"
- **Critical (< 3s)**: Red pulsing: "🔒 LOCKING IN 3s"
- **Locked (= 0)**: Disabled state: "🔒 Vote locked"

**Benefits**:
- Clear visual feedback about time pressure
- Reduces user confusion during critical moments
- Better game flow and user experience
- Consistent timing across all vote interactions

### Technology Stack Updates

| Layer              | Updated Technology                    | Reason for Change                                          |
| ------------------ | ------------------------------------- | ---------------------------------------------------------- |
| **Real-time Chat** | HTTP polling / WebSocket (configurable) | Added WebSocket support via Ably for better performance    |
| **State Management** | Custom hooks + Context                | Consolidated state management patterns                     |
| **UI Components**  | Component consolidation               | Reduced 31 components to 28, ~340 LOC saved                |
| **Timer Logic**    | Centralized useCountdown hook         | Single source of truth for all countdowns                  |

This architecture provides a solid foundation for scaling from MVP to production while maintaining the core Farcaster-native experience.

---

## Bot Communication Enhancement Plan

### Current State
- Personality profiles extracted (20+ traits: greetings, questions, tone, emojis, etc.)
- Adaptive responses using only 3 traits (`initiatesConversations`, `asksQuestions`, `isDebater`)
- Typing delays: 200ms base + char-based scaling (too fast for realistic delivery)
- No cross-conversation memory (each round isolated)

### Identified Issues
2. **Unrealistic typing speed**: Messages appear instantly after 200-800ms delay
3. **Under-utilized personality data**: `frequentPhrases`, `responseStarters`, `responseClosers`, `emotionalTone`, `topicKeywords`, `reactionEmojis` not used in response generation
4. **Personality mismatches**: Both bots open identically even when their patterns differ
5. **Terse/verbose styles not reflected**: `communicationStyle` extracted but not applied

### Implementation Strategy

**PHASE 1: Safe Enhancement (No Schema Changes) - COMPLETE**
These changes are isolated to response generation and don't affect game state synchronization:

**1. Realistic Typing Delays (`src/lib/typingDelay.ts`)** ✅
**Problem**: Messages appeared instantly (200-800ms) - unnatural for conversations

**Solution**: 
- Added **thinking time** (1.5-4s) based on message complexity and personality
- Added **typing simulation** (50-400ms) based on message length and emojis
- Total delay: 2-7 seconds (realistic human response time)

**Key Features**:
- Quick reactions ("lol", "yeah") → 200-600ms thinking
- Complex responses → 1.5-4s thinking (personality-dependent)
- Terse communicators think faster (1.5-2.5s)
- Verbose communicators think longer (2.5-4s)
- Questions trigger longer thinking times automatically

**Files Modified**: 
- `src/lib/typingDelay.ts` - Complete rewrite with 100+ lines of documentation
- `src/app/api/chat/send/route.ts` - Pass personality style to delay calculator

**Examples**:
```
"yeah 🦄" → 450-850ms total
"honestly I'm not sure..." → 2-3.5s total
"that's interesting actually" → 2-3.5s+ total
```

**2. Personality-Aware Responses (`src/lib/inference.ts`)** ✅
**Problem**: Extracted 20+ personality traits but only used 3 in response generation

**Solution**: Enhanced system prompt with "RESPONSE STYLE GUIDANCE" section

**What Was Added**:
- Communication style guidance (terse/verbose/conversational)
- Emotional tone guidance (sarcastic/critical/positive)
- Debate tendency hints
- Response starter patterns
- Topic keyword references
- Response closer suggestions

**Example Prompt Section**:
```
RESPONSE STYLE GUIDANCE:
- KEEP RESPONSES VERY SHORT - They typically respond in 1-3 words
- ⚡ Use subtle sarcasm or wit when appropriate
- They care about: crypto, tech, memes - Reference these when relevant
- Start with patterns like: "gm", "yo" when appropriate
```

**Files Modified**: `src/lib/inference.ts` (lines 456-530) - Added 75+ lines of personality-aware guidance

**3. Opening Move Variance (`src/lib/botProactive.ts`)** ✅
**Problem**: Both bots opened identically despite different personalities

**Solution**: Frequency-weighted greeting selection + personality-based delays

**What Changed**:
- 70% chance to use most common greeting (from bot's cast history)
- 30% chance to pick random greeting (variety)
- Introverts wait 500-1000ms longer before opening message
- Each bot now has distinct, consistent opening pattern

**Files Modified**: `src/lib/botProactive.ts` (lines 322-357) - 35 lines of improvements

**4. Authentic Fallback Responses (`src/lib/inference.ts`)** ✅
**Problem**: Generic fallback templates ("why are you so concerned about that?")

**Solution**: 100% authentic responses from cast history with intelligent combining

**What Changed**:
- Removed reliance on generic RESPONSE_TEMPLATES
- 30% chance to combine 2 similar-length casts naturally
- Sentence-level combining (first of one + last of another)
- Falls back to single casts if combination fails
- Ultimate fallback changed from "..." to "hmm" (more human)

**Example**:
```
Cast 1: "interesting way to think about it"
Cast 2: "definitely true though"
Combined: "interesting way to think about it. definitely true though"
```

**Files Modified**: `src/lib/inference.ts` (lines 126-195) - Enhanced fallback with 60+ lines

**PHASE 2: Lite Memory (Redis-backed, non-blocking) - COMPLETE**
Cross-round context without breaking state sync:

**Core Implementation**:
- New module: `conversationContext.ts` (180 LOC)
- Stores minimal context: `{playerFid, botFid, roundNumber, topicsDiscussed, playerStyle, playerTone, playerKeyPhrases}`
- Saved to Redis on match lock (async, non-blocking)
- Loaded in generateBotResponse before Venice call
- Passed to Venice prompt as "BACKGROUND CONTEXT" section (informational, not deterministic)
- Falls back gracefully if Redis unavailable
- Zero impact on game state or round synchronization

**How it works**:
1. Player finishes match → lockMatchVote called
2. Context extracted from match.messages (topics, player style, phrases)
3. Saved to Redis: `conversation:{playerFid}:{botFid}`
4. Next round, bot loads context before responding
5. Formatted as prompt section: "Topics discussed: X, Player style: Y"
6. Bot uses as reference (can ignore) - not deterministic

**Data Structure**:
```typescript
{
  playerFid, botFid, roundNumber, cycleId,
  topicsDiscussed: ["crypto", "tech"],
  playerCommunicationStyle: "terse" | "conversational" | "verbose",
  playerEmotionalTone: "positive" | "neutral" | "critical" | "sarcastic",
  playerKeyPhrases: ["build", "ship"],
  lastUpdatedAt: timestamp
}
```

**Files Modified/Created**:
- `src/lib/conversationContext.ts` (NEW) - 180 LOC module
- `src/lib/inference.ts` (lines 340-361, 622-625) - Context loading + prompt insertion
- `src/lib/gameState.ts` (lines 42, 548-559, 713-715) - Context saving + cleanup

**Benefits**:
- Bots flow naturally across rounds ("Earlier you mentioned crypto...")
- Player's patterns (terse, sarcastic, etc.) become clearer over rounds
- Bot reduces repetition by knowing what was discussed
- Falls back gracefully - game works without Redis

**Example Prompt**:
```
BACKGROUND CONTEXT (from previous rounds):
- Topics discussed: crypto, tech, market
- Player style: terse
- Player tone: sarcastic
- Player's phrases: solid point, definitely
```

### Architecture Impact Assessment

**✅ Safe Changes (Zero Breaking Impact)**

| Component | Impact | Breaking? |
|-----------|--------|-----------|
| **Typing Delays** | Response generation only | ❌ No |
| **System Prompt** | Information added to Venice input | ❌ No |
| **Opening Moves** | Proactive response generation | ❌ No |
| **Fallback Responses** | Response generation fallback | ❌ No |
| **Context Storage** | Non-blocking Redis write | ❌ No |
| **Context Loading** | Optional prompt section | ❌ No |

**✅ No Changes to**:
- Match/Player/Bot types (no schema changes)
- Game state synchronization logic
- Round progression (time-based, not event-based)
- Redis keys (added new `conversation:*` keys, no conflicts)
- Persistence layer
- Database schema

**✅ Resilience**:
- Venice API timeout → Fallback to authentic cast history
- Personality data missing → Uses defaults
- Context data missing → Bot responds without context (normal behavior)
- Required services (Redis, Database, APIs) fail fast at startup

### Testing Recommendations

**Unit Tests**:
```typescript
// typingDelay.ts
- calculateTypingDelay(message, style, userMessage) returns 2-7s
- terse style responses faster than verbose
- Complex messages get longer thinking time

// conversationContext.ts
- extractTopics() finds relevant keywords
- inferPlayerStyle() correctly classifies terse/verbose
- saveConversationContext() doesn't block
- loadConversationContext() returns null gracefully

// inference.ts
- fallback responses come from actual casts
- personality guidance appears in system prompt
```

**Integration Tests**:
```typescript
// End-to-end conversation flow
1. Bot responds in Round 1 with typing delay (2-7s)
2. Context saved on match lock
3. Round 2: Context loaded + appears in prompt
4. Bot's next response references previous topics
5. Verify no game state corruption

// Personality variance
1. Terse bot opens faster than verbose bot
2. Each bot's opening uses their actual greetings
3. System prompt includes style guidance
4. Responses match personality pattern

// Fallback scenarios
1. Redis unavailable → bots still respond
2. Venice API timeout → cast-history fallback works
3. No context data → bots respond normally
```

**Live Monitoring**:
- Track bot response times (should be 2-7s, not <1s)
- Monitor context save/load success rate
- Measure bot response repetition (should ↓ by ~40%)
- Collect user feedback on realism

### Deployment Checklist

- [ ] **Code Review**: All changes reviewed for safety
- [ ] **Unit Tests**: typingDelay, conversationContext, fallback responses
- [ ] **Integration Tests**: End-to-end conversation flow
- [ ] **Redis Verification**: Upstash configured, context keys tested
- [ ] **Staging Deployment**: Run full game cycle with 3+ players
- [ ] **Live Monitoring**: Set up logging for context saves/loads
- [ ] **Documentation**: Update ARCHITECTURE.md ✅ (already done)

### Performance Impact

**Expected Metrics**:
- **Venice API calls**: No change (same rate)
- **Redis calls**: +2 per match (save context + next round load)
- **Memory footprint**: Negligible (context ~500 bytes)
- **Response latency**: +2-5s thinking time (intentional UX improvement)

**Cost**:
- **Upstash Redis**: ~2 KB per bot-player pair per cycle
- **Venice API**: Unchanged
- **Compute**: Negligible (<1ms per context operation)

**PHASE 3: Arbitrum Native + Flow State Integration (Monetization)**

This phase introduces Arbitrum transactions at registration to enable [Flow State](https://flowstate.network/) builder incentive program via Superfluid streaming.

#### **Why This Matters**

Flow State is a program that incentivizes Farcaster mini app developers—paying builders per-second based on traction, not weekly. Detective becomes a perfect fit:
- **Proof-of-Intent**: Arbitrum TX at registration (prevents sybil attacks, on-chain record)
- **Traction Signal**: Player count + engagement metrics → builder streaming rate
- **Continuous Payment**: Superfluid streams disbursements per-second vs batch payouts

#### **Core Design: Transaction-Gated Entry**

Current registration: `Auth → Neynar Check → Game Lobby`  
New registration: `Auth → Neynar Check → TX Signature (0.001 ARB or sponsored) → Game Lobby`

**Key Principle**: Minimal friction entry point. Gas cost near-zero (~$0.0001) on Arbitrum. Transaction serves dual purpose:
1. **Proof-of-intent on-chain** (sybil-resistant, transparent)
2. **Traction metric for Flow State** (entry TXs per cycle = measurable activity)

#### **Integration Points**

**1. Registration Flow** (`src/components/game/BriefingRoom.tsx` line 52)
```typescript
// Before calling /api/game/register:
// 1. Check Arbitrum wallet connection
// 2. If not connected, request connection
// 3. Prepare entry TX (0 or 0.001 ARB)
// 4. User signs TX
// 5. Wait for confirmation (can be async in background)
// 6. Call /api/game/register with txHash as proof
```

**2. Smart Contract** (Deploy to Arbitrum)
```solidity
// DetectiveGameEntry.sol
contract DetectiveGameEntry {
    mapping(address => uint256) public registrations;
    event PlayerRegistered(address indexed player, uint256 fid);
    
    function registerForGame(uint256 fid) external payable {
        require(msg.value >= minEntryFee);
        registrations[msg.sender] = fid;
        emit PlayerRegistered(msg.sender, fid);
        // Fees accumulate → available to Flow State pool
    }
}
```

**3. API Verification** (`src/app/api/game/register/route.ts`)
```typescript
// NEW: Verify Arbitrum TX before registration
if (NEXT_PUBLIC_REQUIRE_TX === 'true') {
    const isValidTx = await verifyArbitrumTx(txHash, walletAddress, fid);
    if (!isValidTx) return error(403);
}
// Proceed with existing registration logic
```

**4. Wallet Integration** (`src/components/UnifiedAuthComponent.tsx`)
- Offer Arbitrum wallet connection immediately after Farcaster auth
- Support MetaMask, WalletConnect (built into Warpcast mini app)
- Cache wallet address in localStorage for subsequent games

#### **Flow State Streaming Model** (Optional, Longer-term)

**Evaluation**: Superfluid streaming is **well-suited for this IF:**
- Flow State has a fund pool specifically for Detective
- Your builder wallet is registered with Flow State
- Traction metrics (cycle revenue, player count) are transparent on-chain

**How it works**:
```typescript
// After each game cycle completes:
// 1. Calculate cycle traction: (players × engagement) / baseline
// 2. Flow State multiplies this by pool allocation to derive flowRate
// 3. Superfluid streams start: USDCx/second to your wallet
// 4. Inbound flows persist until app loses traction or pool dries

const cycleMetrics = {
    playerCount: players.length,
    engagementScore: avgMessagesPerRound,
    accuracyDifficulty: avgWrongGuesses, // Harder = more valuable
};

// Flow State daemon calculates:
// flowRate = (cycleMetrics.score / totalEcosystemScore) * poolAllocation
```

#### **Why Superfluid Streaming is or isn't a good fit**

**Good Fit IF:**
✅ Flow State pool exists for Detective  
✅ Metrics are transparent on-chain (entry TXs, player engagement)  
✅ You need predictable per-second payouts (vs batch weekly)  
✅ Pool is well-capitalized (otherwise rate → 0 as pool depletes)

**NOT a Good Fit IF:**
❌ Flow State pool is finite (no revenue source) → depletes to zero  
❌ Metrics are hard to verify on-chain → requires oracle/off-chain validation  
❌ You'd rather capture direct entry revenue (keep fees) than streaming share  
❌ Players prefer fee-free signup (TX friction reduces conversion)

**Recommendation**: Start with **Arbitrum TXs only** (Phase 3A), then **opt-in to Flow State** (Phase 3B) only if:
1. Flow State program explicitly includes Detective in their pool
2. You want per-second payouts over batch distributions
3. Your growth can sustain the pool (shrinking ecosystem = shrinking rate)

#### **Configuration** (Add to `.env.local`)
```bash
NEXT_PUBLIC_ENTRY_CONTRACT=0x...
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_REQUIRE_TX=true              # Feature gate
NEXT_PUBLIC_TX_AMOUNT=0.001              # ARB (can be 0 if sponsored)
```

#### **Phase 3A: Arbitrum Native (Essential)**

**IMPLEMENTED**: 
- ✅ `DetectiveGameEntry.sol` - Minimal proof-of-intent contract
- ✅ `src/lib/arbitrumVerification.ts` - DRY TX signing & verification
- ✅ Enhanced `BriefingRoom.tsx` - Requests TX before registration
- ✅ Enhanced `/api/game/register` - Verifies TX on-chain
- ✅ `.env.example` - Arbitrum configuration

**Files Added/Modified**:
- `contracts/DetectiveGameEntry.sol` (NEW, ~100 LOC)
- `src/lib/arbitrumVerification.ts` (NEW, ~300 LOC, DRY single source of truth)
- `src/app/api/game/register/route.ts` (ENHANCED, +40 LOC)
- `src/components/game/BriefingRoom.tsx` (ENHANCED, +30 LOC)
- `.env.example` (ENHANCED, +25 LOC)

**Design Principles Applied**:
- ENHANCEMENT FIRST: Enhanced existing BriefingRoom & API route vs creating new components
- DRY: Single `arbitrumVerification.ts` module for TX signing & verification
- CLEAN: Clear separation (client TX signing vs server TX verification)
- MODULAR: Testable, composable utility functions
- ORGANIZED: Domain-driven design (Arbitrum config → verification → integration)

**Timeline**: Complete (~6 hours)  
**Complexity**: Medium  
**Risk**: Low (no external dependencies, contract is ~100 LOC minimal)

#### **Phase 3B: Flow State Integration (Optional, Deferred)**
- Confirm with Flow State team if Detective is in scope
- Register builder wallet with Flow State program
- Expose traction metrics via Superfluid Distribution
- Monitor streaming inflows

**Timeline**: 4-6 weeks (after 3A stabilizes)  
**Complexity**: High (requires Superfluid SDK, coordination with Flow State)  
**Risk**: Medium (pool depletion risk, Flow State program clarity)

#### **Launch Strategy (Phase 3A Only)**
1. **Week 1-2**: Optional TX (measure wallet adoption friction)
2. **Week 3-4**: Required but free (gas-sponsored via Arbitrum)
3. **Week 5+**: Minimal fee (0.001 ARB or keep at 0)

**Decision Point (Week 5)**: Based on TX volume + player feedback, decide whether to pursue Phase 3B with Flow State.

#### **Success Metrics (Phase 3A)**
- % of players willing to sign TX (conversion rate)
- On-chain entry TX count per cycle
- Player retention (repeat registrations)
- Gas cost efficiency (Arbitrum should be <$0.0001/TX)

#### **Deployment Checklist (Phase 3A)**

**1. Smart Contract Deployment**
```bash
# Deploy DetectiveGameEntry.sol to Arbitrum Sepolia (testnet)
# 1. Install Foundry or Hardhat
# 2. Compile contract: forge build (or npx hardhat compile)
# 3. Deploy to testnet:
#    forge create --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
#                 --private-key $PRIVATE_KEY \
#                 contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
#                 --constructor-args 0  # minEntryFee = 0 (free)
# 4. Save contract address from output
```

**2. Configuration**
```bash
# Copy .env.example → .env.local
cp .env.example .env.local

# Add to .env.local:
NEXT_PUBLIC_ARBITRUM_ENABLED=true
NEXT_PUBLIC_ARBITRUM_ENTRY_CONTRACT=0x{contract_address_from_step_1}
NEXT_PUBLIC_ARBITRUM_MIN_FEE=0                         # Free for now
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

**3. Local Testing**
```bash
# Test Arbitrum TX signing flow locally
npm run dev

# In browser:
# 1. Go to http://localhost:3000
# 2. Farcaster auth
# 3. Click "Register" → MetaMask prompt should appear
# 4. Sign TX (or use Foundry anvil for local testnet)
# 5. Verify /api/game/register receives TX hash
```

**4. E2E Testing (Testnet)**
```bash
# 1. Get testnet ETH from faucet
#    https://faucet.quicknode.com/arbitrum/sepolia
# 2. Deploy contract to Sepolia testnet
# 3. Update env vars to point to Sepolia contract
# 4. Test registration flow (TX should succeed with test ETH)
# 5. Verify TX on Arbitrum Sepolia explorer
#    https://sepolia-explorer.arbitrum.io/
```

**5. Production Deployment**
```bash
# 1. Deploy to Arbitrum Mainnet
# 2. Update .env vars (Vercel dashboard or .env.local)
# 3. Set NEXT_PUBLIC_ARBITRUM_ENABLED=true
# 4. Monitor first registrations (check logs for TX verification)
# 5. Gradual rollout: Can toggle NEXT_PUBLIC_ARBITRUM_ENABLED on/off anytime
```

**6. Monitoring & Debugging**
- Check browser console for `[ArbitrumVerification]` logs
- Check server logs for `[Registration]` logs
- Monitor TX success rate: `POST /api/game/register` with `arbitrumTxHash`
- Use Arbiscan explorer to verify on-chain registrations

**IMPORTANT**: Phase 3A (Arbitrum native) is **essential for traction measurement**. Phase 3B (Flow State) is **optional and should only be pursued if the program explicitly supports Detective**.


### Files Summary

**Phase 1-2 (Bot Communication)**

**New Files (1)**:
- `src/lib/conversationContext.ts` (180 LOC)

**Modified Files (4)**:
- `src/lib/typingDelay.ts` (50% rewrite, 120 LOC)
- `src/lib/botProactive.ts` (35 LOC added)
- `src/lib/inference.ts` (180 LOC added/modified)
- `src/app/api/chat/send/route.ts` (15 LOC modified)
- `src/lib/gameState.ts` (20 LOC added)

**Phase 3A (Arbitrum Native - Implemented)**

**New Files (2)**:
- `contracts/DetectiveGameEntry.sol` (100 LOC, minimal proof-of-intent contract)
- `src/lib/arbitrumVerification.ts` (300 LOC, DRY single source of truth for TX signing/verification)

**Modified Files (3)**:
- `src/app/api/game/register/route.ts` (+40 LOC, add TX verification step)
- `src/components/game/BriefingRoom.tsx` (+30 LOC, request TX before registration)
- `.env.example` (+25 LOC, Arbitrum configuration variables)

**Total Phase 1-2**: ~450 LOC new, ~250 LOC modified  
**Total Phase 3A**: ~400 LOC new, ~95 LOC modified  
**Code Deleted**: 0 LOC (all additive, follows DRY principle)