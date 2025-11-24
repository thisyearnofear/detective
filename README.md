# Detective - Farcaster Mini App

🔍 **An AI-powered social deduction game on Farcaster**

Can you tell if you're chatting with a real person or an AI bot trained on their posts?

## About

Detective is a Farcaster mini app where players engage in short conversations and guess whether they're speaking with another real user or an intelligent bot. The bot is trained on the player's recent Farcaster posts, making the impersonation as authentic as possible.

**Current Status**: Phase 1 (Foundation) Complete ✓  
**Next**: Phase 2 (AI Integration & Polish) - 1 week  
**Target Launch**: Early December 2025

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

## Project Structure

```
src/
├── app/                    # Next.js pages & API routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── api/               # API endpoints (Phase 2)
├── components/            # Reusable React components (Phase 2)
├── lib/
│   ├── gameState.ts       # In-memory game state store
│   ├── neynar.ts          # Neynar API client
│   └── claude.ts          # Claude bot logic
├── hooks/                 # Custom React hooks (Phase 2)
└── styles/
    └── globals.css        # Tailwind styles
```

## Development Roadmap

### Phase 1: MVP Foundation (1-2 weeks) ✓
- [x] Next.js project setup with modern tech stack
- [x] In-memory game state store
- [x] Neynar API integration (user fetch, cast scraping, score validation)
- [x] Claude API integration (bot response generation)
- [x] Landing page & error handling

### Phase 2: AI Integration & Polish (1 week)
- [ ] API routes for game flow (register, match, chat, vote, leaderboard)
- [ ] React components (chat UI, voting, leaderboard, timer)
- [ ] Claude prompt engineering & optimization
- [ ] User testing with 5-10 beta players
- [ ] Mobile responsiveness & UX polish

### Phase 3: Multi-Game Support (1 week)
- [ ] Game cycle lifecycle management
- [ ] Basic analytics & cost tracking
- [ ] Optional: Vercel KV for multi-instance sync
- [ ] Production deployment setup

### Phase 4: Soft Launch (1 week)
- [ ] First public game cycle (50 players)
- [ ] Community announcement & Discord/Twitter awareness
- [ ] Real-time monitoring & bug fixes
- [ ] Leaderboard & results sharing

### Phase 5: Growth & Refinement (Ongoing)
- [ ] Iterative improvements based on user feedback
- [ ] Seasonal themes & special events
- [ ] Optional: NFT badges for top scorers
- [ ] Analytics dashboard

## Game Mechanics

### Registration Phase
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
- System prompt injects:
  - Username & display name
  - Top 10 recent casts
  - Inferred tone & writing style
  - Instruction to stay under 240 chars (Farcaster limit)

### Voting & Scoring
- After each match: Guess "Real" or "Bot"
- Accuracy calculated per user
- Leaderboard sorted by:
  1. Accuracy (%)
  2. Speed (first to correct answer wins tiebreaker)

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

## Acknowledgments

- Original Detective game concept: [Stefan Bohacek](https://stefanbohacek.online/)
- Farcaster mini app infrastructure
- Neynar API & community
- Anthropic Claude for the AI brain

---

**Built for Farcaster. Made with ❤️**

See [ROADMAP.md](ROADMAP.md) for detailed development plan.  
See [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) for migration notes.
