# Detective - Farcaster Mini App

🔍 **An AI-powered social deduction game on Farcaster**

Can you tell if you're chatting with a real person or an AI bot trained on their posts?

## Documentation

For detailed information about the project, please refer to the following documentation files:

1. [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architecture and core concepts
2. [DEVELOPMENT_IMPLEMENTATION.md](docs/DEVELOPMENT_IMPLEMENTATION.md) - Development guide and implementation
3. [UI_UX_ENHANCEMENT.md](docs/UI_UX_ENHANCEMENT.md) - UI/UX design and enhancement
4. [ADVANCED.md](docs/ADVANCED.md) - Advanced features and deployment

## About

Detective is a Farcaster mini app where players engage in short conversations and guess whether they're speaking with another real user or an intelligent bot. The bot is trained on the player's recent Farcaster posts, making the impersonation as authentic as possible.

**Current Status**: Phase 1-3 (Complete) ✅ UI/UX Enhancement Done
**Status**: Production Ready  
**Build**: ✅ Passing (Next.js 15.5.6, TypeScript strict)

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
- **Authentication**: Farcaster Mini App SDK
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

## UI/UX Enhancement (Nov 25, 2025) ✅

### Phase 1: Visual Foundation
- ✅ Canvas-based animated gradient background (state-aware colors)
- ✅ SVG progress ring timer with color transitions
- ✅ Message entrance animations (staggered 40ms per message)
- ✅ Vote feedback animations (correct/incorrect/lock states)

### Phase 2: Immersion & Feedback  
- ✅ OpponentCard with color extraction from profile pictures
- ✅ RegistrationLoader with step-by-step animations
- ✅ RoundStartLoader with countdown
- ✅ Color-coded chat borders (desktop) and tab indicators (mobile)

### Phase 3: Polish & Edge Cases
- ✅ Enhanced inactivity warnings with glow effects
- ✅ Smooth round transitions with overlay effects
- ✅ Error card component with severity levels
- ✅ Results card with accuracy tracking

**Delivered**: 16 new/enhanced components, 20+ CSS animations, zero breaking changes, <3KB bundle growth

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