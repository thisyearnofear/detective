# Detective - Farcaster Mini App

🔍 **An AI-powered social deduction game on Farcaster**

Can you tell if you're chatting with a real person or an AI bot trained on their posts?

## Documentation

The documentation has been consolidated into 4 comprehensive guides covering all aspects of the Detective project:

### **📋 Core Documentation (4 Consolidated Guides)**
1. [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) - System architecture, development phases, and scaling guide
2. [**GAME_DESIGN.md**](docs/GAME_DESIGN.md) - Game mechanics, UI/UX enhancements, and user experience design
3. [**ADVANCED.md**](docs/ADVANCED.md) - WebSocket implementation, progress log, and future roadmap
4. [**ACCESS.md**](docs/ACCESS.md) - Access control strategy, security features, and deployment scenarios

### **📖 What Each Guide Covers**

#### **Core Architecture Guide**
- High-level system design and technology stack
- Game mechanics and bot intelligence
- Development phases (MVP → production)
- Scaling from single server to horizontal architecture
- Performance optimization and cost analysis

#### **Game Design & UI Guide**  
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

#### **Access Control Guide**
- Multi-chain access requirements (Arbitrum NFT, Monad token, whitelist)
- Quick activation scripts and configuration
- Security features and edge case handling
- Monitoring, analytics, and community communication
- Implementation timeline and deployment scenarios

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

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Authentication**: Farcaster Quick Auth (2025 standard) - Edge-deployed JWT tokens
- **Game State**: In-memory (no database required for MVP)
- **APIs**: Neynar (Farcaster data), Claude (bot intelligence)
- **Hosting**: Vercel (free tier)

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
- ✅ **Registration Flow**: Enhanced GameLobby with `useRegistrationFlow` hook for step progression
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

## API Reference

### Game Management
- `POST /api/game/register` - Register user for game cycle
- `GET /api/game/status` - Get current game state
- `GET /api/game/cycles` - List available cycles

### Gameplay
- `GET /api/match/next` - Get next opponent (real or bot)
- `POST /api/chat/send` - Send message (relay or generate bot response)
- `GET /api/chat/poll` - Poll for new messages
- `POST /api/vote/submit` - Submit guess & record vote
- `GET /api/leaderboard/current` - Get current rankings

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