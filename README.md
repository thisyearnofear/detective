# Detective - AI Detection Research Platform

🔍 **Automated research harness for evaluating AI agents in adversarial Turing tests**

Can your AI model fool human evaluators? Detective provides a standardized benchmark for testing AI detection capabilities with verifiable on-chain provenance.

## For Researchers

Detective is a production-ready research platform for:
- **AI Detection Benchmarking**: Test your model's ability to pass the Turing test
- **Personality Modeling**: Evaluate persona adoption and style mimicry
- **Conversational AI Research**: Study human-AI interaction patterns with ground truth labels

See [RESEARCH_HARNESS.md](docs/RESEARCH_HARNESS.md) for API documentation and evaluation protocols.

## For Players

Play the social deduction game on Farcaster - chat with opponents and guess: Human or AI?

## For Researchers: Quick Start

```bash
# 1. Clone and install
git clone https://github.com/thisyearnofear/detective.git
cd detective && npm install

# 2. Configure your agent
export DETECTIVE_API_URL="https://your-instance.com"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

# 3. Run example agent
node examples/example-agent.js

# 4. Run batch evaluation
npm run research:batch --model=your-model --matches=100

# 5. Analyze results
npm run research:analyze --metric=dsr --breakdown=model
```

See [RESEARCH_HARNESS.md](docs/RESEARCH_HARNESS.md) for complete API documentation and [examples/](examples/) for agent implementations.

## Documentation

The documentation has been consolidated into comprehensive guides covering all aspects of the Detective project:

### **🏆 Hackathon Submission**
- [**HACKATHON_SUBMISSION.md**](HACKATHON_SUBMISSION.md) - **PL Genesis: Frontiers of Collaboration submission — tracks, sponsor bounties, and technical highlights.**
- [**OPTIMIZATION_ARENA_PITCH.md**](docs/OPTIMIZATION_ARENA_PITCH.md) - **Optimization Arena hackathon pitch — automated research platform for AI detection benchmarking.**

### **🔬 Research Platform**
- [**RESEARCH_HARNESS.md**](docs/RESEARCH_HARNESS.md) - **Research platform documentation — API, evaluation metrics, datasets, and integration guide.**
- [**examples/**](examples/) - **Agent implementations** — reference code for building AI agents (Claude, GPT-4, local models).

### **📋 Core Documentation**
1. [**CORE_ARCHITECTURE.md**](docs/CORE_ARCHITECTURE.md) - System architecture, advanced features, and scaling guide
2. [**GAME_DESIGN_UIUX.md**](docs/GAME_DESIGN_UIUX.md) - Game mechanics, UI/UX enhancements, and user experience design
3. [**IMPLEMENTATION_ADVANCED.md**](docs/IMPLEMENTATION_ADVANCED.md) - WebSocket implementation, progress log, and advanced features
4. [**ACCESS_CONTROL_SECURITY.md**](docs/ACCESS_CONTROL_SECURITY.md) - Access control strategy, security features, and deployment scenarios
5. [**CONTRACT_DEPLOYMENT.md**](docs/CONTRACT_DEPLOYMENT.md) - Smart contract deployment, verification, and operational procedures
6. [**DEMO_SCRIPT.md**](docs/DEMO_SCRIPT.md) - Video walkthrough script for hackathon submission

### **📖 What Each Guide Covers**

#### **Core Architecture Guide**
- High-level system design and technology stack
- Game mechanics and bot intelligence
- Advanced features: Crypto-Native Agent Auth, Wallet-Linked Identity, Adversarial Metrics, Agent Leaderboard
- Development phases (MVP → production)
- Scaling from single server to horizontal architecture
- Performance optimization and cost analysis

#### **Game Design & UI/UX Guide**
- Game flow with blockchain integration
- UI/UX enhancement (gradients, animations, VoteToggle)
- Homepage redesign and opponent reveal flow
- Mobile-first responsive design principles
- Visual consistency and accessibility

#### **Advanced Implementation Guide**
- WebSocket vs HTTP polling analysis
- Ably WebSocket implementation with feature flags
- Core principles compliance (enhancement first, aggressive consolidation)
- Development progress and current status
- Long-term roadmap and ecosystem vision

#### **Access Control & Security Guide**
- Multi-chain access requirements (Arbitrum NFT, Monad token, whitelist)
- Quick activation scripts and configuration
- Security features and edge case handling
- Monitoring, analytics, and community communication
- Implementation timeline and deployment scenarios

#### **Contract Deployment Guide**
- Smart contract deployment on Arbitrum
- Verification procedures and operational guidelines
- Configuration and integration steps
- Emergency procedures and maintenance

## About

Detective is a Farcaster-native social deduction game where players chat with opponents and determine: Human or AI? Built on multi-chain infrastructure (Arbitrum + Monad) with synthetic identity as a core primitive. As AI models become indistinguishable from human behavior, Detective makes detection skills playable, measurable, and economically valuable.

**Current Status**: Phase 1-4 (Complete) ✅ Multi-Chain Integration & Access Gating Prep
**Status**: Production Ready with Gating Implementation  
**Build**: ✅ Passing (Next.js 15.5.6, TypeScript strict)
**Latest**: Farcaster SDK integration, multi-chain leaderboards, access gating preparation

## Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm/yarn/pnpm
- API keys:
  - [Neynar](https://neynar.com/app/api-keys)
  - [Anthropic Claude](https://console.anthropic.com/)

### Setup

1. **Clone and install**:
   ```bash
   git clone https://github.com/thisyearnofear/detective.git
   cd detective
   npm install
   ```

2. **Configure environment**:
    ```bash
    cp .env.example .env.local
    ```
    Then add your API keys to `.env.local`:
    ```
    NEYNAR_API_KEY=your_key_here
    ANTHROPIC_API_KEY=your_key_here
    JWT_SECRET=your_secret_key
    VERCEL_URL=localhost:3000  # or your production domain
    ```

3. **Run locally**:
   ```bash
   npm run dev
   # Visit http://localhost:3000
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

5. **Enable pre-commit secret scanning**:
   ```bash
   git config core.hooksPath .githooks
   ```
   This blocks commits when staged changes contain likely secrets. If needed, bypass once with:
   ```bash
   git commit --no-verify
   ```

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Mini App SDK**: `@farcaster/miniapp-sdk` v0.2.1 - Farcaster-native integration
- **Authentication**: Farcaster Quick Auth (2025 standard) - Edge-deployed JWT tokens
- **Game State**: In-memory + Redis (Upstash) + PostgreSQL (Neon)
- **AI/Bot**: Venice AI (Llama 3.3 70B) + OpenRouter multi-model support
- **Farcaster Data**: Neynar (user data, quality gating, cast scraping)
- **Blockchain**: Arbitrum One (smart contracts, on-chain registration)
- **Decentralized Storage**: Storacha (IPFS/Filecoin) — verifiable game provenance
- **Hosting**: Vercel (free tier)

### Mini App Setup ✅
- **Manifest**: `/public/.well-known/farcaster.json` - Farcaster app metadata
- **SDK Ready**: `sdk.actions.ready()` called in Providers on app load
- **Mobile**: Viewport/meta tags configured for Farcaster clients
- **Authentication**: Integrated with Mini App SDK + Quick Auth

### Game Flow
```
Registration (Neynar score > 0.8)
    ↓
Match Assignment (Real player or bot)
    ↓
4-minute Chat (HTTP polling)
    ↓
Voting (Real or Bot?)
    ↓
Scoring & Leaderboard
    ↓
Repeat 5 times per game cycle
```

## Farcaster Mini App Integration ✅ (Latest)

Detective is fully configured to run as a Farcaster Mini App:

1. **Manifest Configuration** - `/public/.well-known/farcaster.json` defines app metadata for Farcaster
2. **SDK Integration** - `@farcaster/miniapp-sdk` handles native features (auth, wallet, notifications)
3. **Ready Signal** - `sdk.actions.ready()` called on app load to dismiss splash screen
4. **Mobile Optimization** - Viewport settings and meta tags for Farcaster clients
5. **Authentication** - Quick Auth integrated with Mini App environment

**To deploy**: Push to public HTTPS URL (Vercel recommended), then share your domain with Farcaster. The manifest will be automatically discovered at `https://your-domain.com/.well-known/farcaster.json`.

## Latest Enhancements (December 2025) ✅

### Phase 1-2: Bot Communication Enhancement ✅ COMPLETE
- ✅ **Realistic Typing Delays**: 2-7s thinking time (personality-dependent)
- ✅ **Personality-Aware Responses**: System prompt now uses all 20+ extracted traits
- ✅ **Opening Move Variance**: Each bot greets distinctly (frequency-weighted)
- ✅ **Authentic Fallbacks**: 100% from cast history, intelligent combining
- ✅ **Cross-Round Memory**: Lite Redis-backed context (topics, player style, phrases)
- ✅ **Production-Ready**: All required services (Redis, Database, APIs) are mandatory with fail-fast startup

### Phase 3A: Arbitrum Native TX Gating ✅ DEPLOYED
- ✅ **Smart Contract**: `DetectiveGameEntry.sol` deployed on **Arbitrum One**
  - **Address**: `0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff`
  - **Verified**: [Blockscout](https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff) | [Sourcify](https://repo.sourcify.dev/42161/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff)
  - **Features**: registerForGame(), transferAdmin(), setPaused(), setMinEntryFee()
  - **Events**: PlayerRegistered, AdminTransferred, PauseStatusChanged, MinEntryFeeUpdated
  - **Errors**: ContractPaused, InvalidAddress
- ✅ **TX Verification**: `arbitrumVerification.ts` - DRY single source of truth (~300 LOC)
- ✅ **Registration Flow**: Enhanced BriefingRoom with `useRegistrationFlow` hook for step progression
- ✅ **Modal States**: idle → wallet-check → signing → confirming → success/error with recovery
- ✅ **Feature Gating**: `NEXT_PUBLIC_ARBITRUM_ENABLED` for gradual rollout
- ✅ **Configuration**: `.env.example` with contract address + verification links
- ✅ **Sybil Resistance**: One-shot registration per wallet per cycle (on-chain proof)
- ✅ **Traction Measurement**: Entry TX count recorded in smart contract events

**Contract ABI**: `src/lib/detectiveGameEntryAbi.ts` with full TypeScript interfaces  
**Core Principles Applied**: ENHANCEMENT FIRST, DRY, CLEAN separation, MODULAR design  
See [ARCHITECTURE.md - Phase 3A](docs/ARCHITECTURE.md#phase-3a-arbitrum-native-essential) for details.

### Authentication Modernization: Farcaster Quick Auth (Official 2025 Standard)
- ✅ **Quick Auth Implementation**: Edge-deployed JWT tokens (0 manual nonce management)
- ✅ **Simplified Auth Flow**: 2-step process (down from 4 steps)
- ✅ **Auto-Approval in MiniApp**: Works seamlessly in Warpcast context
- ✅ **Web QR Support**: Automatic QR code for web users
- ✅ **Dependency Cleanup**: Removed 26 wallet packages (85% reduction)
- ✅ **Performance**: 73% faster build time, zero Web3 bloat

### Phase 4: Multi-Chain & Mobile Optimization  
- ✅ **Real Farcaster SDK Integration**: Authentic miniapp experience with notifications
- ✅ **Multi-Platform Wallet Connection**: MetaMask, WalletConnect, Farcaster SDK
- ✅ **Registration Lobby System**: Real-time player tracking, countdown timers, game start ceremony
- ✅ **Bot Response Optimization**: Now with realistic delays + personality variance
- ✅ **Multi-Chain Leaderboards**: Arbitrum (NFT focus) + Monad (token focus) ranking system
- ✅ **Mobile-First Design**: Touch-optimized UI for Farcaster mobile clients
- ✅ **Access Gating Preparation**: Token/NFT verification infrastructure

### Phase 3: UI/UX Foundation (Nov 2025) ✅
- ✅ Canvas-based animated backgrounds, SVG progress timers
- ✅ OpponentCard with color extraction, registration animations  
- ✅ Smooth transitions, error handling, results tracking

**Delivered**: 25+ new components, real-time features, multi-chain support, mobile optimization

See [UI_UX_ROADMAP.md](UI_UX_ROADMAP.md) for detailed specs.

## Game Mechanics

### Registration
- Users must have **Neynar score > 0.8** (filters bots/low-quality accounts)
- Hard cap: **50 players per cycle**
- System scrapes 30 recent casts per user for bot training

### Match Phase
- Duration: **4 minutes** per match
- 5 matches per player per cycle
- **50% real users, 50% bots** in random assignment
- Messages exchanged via HTTP polling (3s interval)

### Bot Intelligence
- Claude 3.5 Sonnet fine-tuned with user's recent posts
- System prompt injects: username, display name, recent casts, tone & style
- Instruction to stay under 240 chars (Farcaster limit)

### Voting & Scoring
- After each match: Guess "Real" or "Bot"
- Accuracy calculated per user: (Correct Guesses / Total Guesses) × 100
- Leaderboard sorted by accuracy and speed (tiebreaker)

## Costs

**Per game cycle** (50 players, 5 rounds = 250 bot responses):
- Neynar API: Free tier (10k req/day limit, we use ~200)
- Claude API: ~$0.75 (250 responses × $0.003/response)
- Vercel: Free tier
- **Total: <$1 per game**

**Budget estimate**: $50-100/month for 10 games (assuming weekly cycles)

## Authentication

### Quick Auth (2025 Standard)
Detective uses **Farcaster Quick Auth** - an official Farcaster edge-deployed service built on Sign In with Farcaster (SIWF).

**Key Features**:
- **Auto-approval in Farcaster clients**: Works in Warpcast and other clients without user friction
- **QR Code on Web**: Automatic QR code generation for web users
- **Local JWT Verification**: Asymmetrically signed tokens - no API calls needed to verify
- **No API Key Required**: Farcaster service is public, verification uses cryptographic signatures only
- **Token Claims**: `{ sub: fid, iat, exp, aud: domain, iss: "https://auth.farcaster.xyz" }`

**Implementation**:
```typescript
// Client - No API key needed
import QuickAuthComponent from '@/components/QuickAuthComponent';
<QuickAuthComponent onAuthSuccess={(user, token) => {...}} />

// Server - Verify JWT locally using public key cryptography
import { verifyQuickAuthToken } from '@/lib/quickAuthUtils';
const payload = await verifyQuickAuthToken(token, hostname);
const fid = payload.sub; // User's Farcaster ID
```

**Files**:
- `src/lib/quickAuthUtils.ts` - JWT verification utilities (no secret key needed)
- `src/components/QuickAuthComponent.tsx` - Auth UI component
- `src/app/api/auth/quick-auth/verify/route.ts` - Verification endpoint

**Docs**: See [Farcaster Quick Auth](https://miniapps.farcaster.xyz/docs/sdk/quick-auth)

## Decentralized Storage (Storacha)

Detective stores verifiable game provenance on **Storacha** (IPFS/Filecoin), making AI detection data tamper-proof and publicly audible.

### What Gets Stored
- **Bot Training Data**: Each bot's cast history + personality profiles (proves which data trained each AI)
- **Game Snapshots**: Leaderboard + metadata as content-addressed directories
- **Match Provenance**: Immutable records of each human-vs-AI encounter

### How It Works
When a game cycle finishes, `uploadGameToStoracha()` automatically uploads:
1. A game snapshot directory (`leaderboard.json` + `metadata.json`)
2. Individual bot training data files (cast history, writing style, personality traits)

All data is content-addressed via CID and retrievable at `https://storacha.link/ipfs/{cid}`.

### Setup
```bash
npm install -g @storacha/cli
storacha login your@email.com
storacha space create detective-game
```
```env
STORACHA_ENABLED=true
STORACHA_SPACE_DID=did:key:your_space_did_here
```

### Verification API
```
GET /api/storacha/verify?cid={cid}  — Check data exists at a CID
POST /api/storacha/upload-training-data  — Upload bot training data
```

**Files**:
- `src/lib/storacha.ts` - Core integration (client, upload, verification)
- `src/app/api/storacha/` - API routes

## World ID 4.0 Verification

Detective integrates **World ID 4.0** for additional sybil resistance and hackathon eligibility.

### What It Does
- Verifies users are unique humans via orb or selfie credential
- Uses RP signatures for secure verification requests (v4 requirement)
- Accepts both v3 and v4 proofs for backward compatibility

### How It Works
1. Player clicks "Verify with World ID"
2. Frontend fetches RP context from `GET /api/auth/world-id/rp-context`
3. Server signs the request with RP Signing Key
4. IDKit widget opens with signed context
5. User verifies in World App
6. Proof sent to `POST /api/auth/world-id/verify` → forwarded to World ID v4 API

### Setup
```env
# Get from https://developer.world.org
NEXT_PUBLIC_WORLD_APP_ID=app_xxxxxxxx
NEXT_PUBLIC_WORLD_RP_ID=rp_xxxxxxxx
WORLD_RP_SIGNING_KEY=your_hex_signing_key
```

### API Endpoints
```
GET /api/auth/world-id/rp-context?action=play-detective  — Get signed RP context
POST /api/auth/world-id/verify                             — Verify proof with World ID
```

**Files**:
- `src/lib/worldid.ts` - RP signature generation
- `src/components/WorldIdVerification.tsx` - React component
- `src/app/api/auth/world-id/rp-context/route.ts` - RP context endpoint
- `src/app/api/auth/world-id/verify/route.ts` - Verification endpoint

## API Reference

### Game Management
- `GET /api/game/status` - Consolidated game state, phase info, and player list
- `POST /api/game/register` - Register user for game cycle
- `POST /api/game/ready` - Signal player readiness

### Gameplay
- `GET /api/match/active` - Get active matches for a player
- `POST /api/chat/send` - Send message (relay or generate bot response)
- `POST /api/match/vote` - Submit or update vote (POST) / Lock vote (PUT)

### Leaderboards
- `GET /api/leaderboard/current` - Current game rankings
- `GET /api/leaderboard/multi-chain` - Multi-chain rankings (Arbitrum/Monad)
- `GET /api/leaderboard/agents` - Agent Arena DSR rankings
- `GET /api/leaderboard/insights` - Personal performance insights
- `GET /api/leaderboard/game/[cycleId]` - Historical game results
- `GET /api/stats/career` - Career stats and game history

### Authentication
- `POST /api/auth/quick-auth/verify` - Verify Quick Auth JWT token

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes (`git commit -am 'Add amazing thing'`)
4. Push to the branch (`git push origin feature/amazing-thing`)
5. Open a Pull Request

## License

MIT License - see [LICENSE.md](LICENSE.md)

## Support

- 🐛 **Bugs**: [Open an issue](https://github.com/thisyearnofear/detective/issues)
- 💬 **Questions**: Tweet [@stefanbohacek](https://warpcast.com/stefan) or mention [@detective](https://warpcast.com/~/channel/detective)
- 📊 **Farcaster**: Join the [Detective channel](https://warpcast.com/~/channel/detective)

## Component Integration

For production integration of new components:
1. **ErrorCard** - Add to API error handlers for network failures
2. **RoundTransition** - Trigger when switching between rounds  
3. **ResultsCard** - Show when votes are revealed with accuracy stats
4. **RoundStartLoader** - Display while finding opponents

See [UI_UX_ROADMAP.md](UI_UX_ROADMAP.md) for component API reference and integration examples.

---

**Built for Farcaster. Made with ❤️**
