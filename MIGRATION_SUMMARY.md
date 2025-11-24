# Detective: Farcaster Migration - Phase 1 Complete ✓

## What Was Done

Successfully migrated Detective from a legacy Express.js + jQuery + MySQL application into a modern **Farcaster-native mini app** built with Next.js 15, TypeScript, and React 19.

### Codeb Cleanup
- **Archived** old codebase in `/archived` directory (Express.js, Gulp, views, db schema, etc.)
- **Removed** 2010s dependencies (old gulp plugins, MySQL, passport-twitter, socket.io, etc.)

### New Tech Stack Initialized
```
Frontend:  Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
Backend:   Next.js API Routes (serverless)
Auth:      @farcaster/miniapp-sdk 0.2.1
Game Logic: In-memory state (Map-based, no database)
APIs:      Neynar SDK (content scraping), Claude API (bot intelligence)
Hosting:   Vercel (free tier)
```

### Project Structure Created
```
detective/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   └── api/               # To be built in Phase 2
│   ├── components/            # UI components (empty, ready for Phase 2)
│   ├── lib/
│   │   ├── gameState.ts       # ✓ In-memory game state store
│   │   ├── neynar.ts          # ✓ Neynar API client & helpers
│   │   └── claude.ts          # ✓ Claude API for bot responses
│   ├── hooks/                 # Custom React hooks (Phase 2)
│   └── styles/
│       └── globals.css        # ✓ Tailwind + custom styles
├── public/                    # Static assets (favicon, etc.)
├── next.config.js             # ✓ Next.js config
├── tsconfig.json              # ✓ TypeScript config
├── tailwind.config.ts         # ✓ Tailwind config
├── postcss.config.js          # ✓ PostCSS config
├── .env.example               # ✓ Environment template
├── .gitignore                 # ✓ Git config
├── ROADMAP.md                 # ✓ Development roadmap (updated)
└── MIGRATION_SUMMARY.md       # This file
```

### Core Game Logic Implemented
- **Game State Store** (`gameState.ts`): 
  - In-memory data structures for users, games, matches, messages, votes
  - Leaderboard calculation
  - Match creation & message handling
  - No database required (state persists during game cycle only)

- **Neynar Integration** (`neynar.ts`):
  - Fetch user profiles by FID
  - Retrieve recent casts for context injection
  - Neynar score validation (> 0.8 quality filter)
  - Bulk user fetching

- **Claude Bot Logic** (`claude.ts`):
  - Generate context-aware bot responses
  - System prompt injection with user's recent posts
  - Response validation & tone extraction
  - ~$0.003 cost per bot response

### Build Status
✅ TypeScript compilation successful  
✅ Next.js build passes (production-ready)  
✅ Git initialized with Phase 1 commit  

## Next Steps: Phase 2 (1 week)

### API Routes to Build
- `/api/game/register` - User registration with Neynar score check
- `/api/game/status` - Current game state
- `/api/game/cycles` - List available game cycles
- `/api/match/next` - Get next opponent (real player or bot)
- `/api/chat/send` - Send message (relay or generate bot response)
- `/api/vote/submit` - Submit guess and calculate score
- `/api/leaderboard/current` - Get live leaderboard

### React Components to Build
- `GameRegister.tsx` - Registration form with quality check
- `ChatWindow.tsx` - Real-time chat interface (HTTP polling)
- `VotingPanel.tsx` - Real/Bot selection UI
- `Leaderboard.tsx` - Rankings display
- `Timer.tsx` - 4-minute match countdown
- `GameStatus.tsx` - Current game cycle info

### Prompt Engineering
- Refine Claude system prompt for user impersonation
- Test with 5-10 beta users
- Iterate based on bot believability feedback

### Testing
- End-to-end: register → match → chat → vote
- Neynar API rate limiting
- Claude API cost tracking
- Message persistence in-memory

## Running Locally

1. **Setup environment**:
   ```bash
   cp .env.example .env.local
   # Add your API keys:
   # NEYNAR_API_KEY=...
   # ANTHROPIC_API_KEY=...
   ```

2. **Install & develop**:
   ```bash
   npm install
   npm run dev
   # Open http://localhost:3000
   ```

3. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Deployment

Ready to deploy to Vercel anytime:
```bash
vercel deploy
```

The app will auto-detect Next.js and configure properly.

## Costs (Estimated)

**Per game cycle** (50 players, 5 rounds each = 250 bot responses):
- Neynar API: Free tier (~200 API calls well under 10k/day limit)
- Claude API: ~$0.75 (250 responses × $0.003)
- Vercel: Free tier
- **Total: <$1/game**

Budget for 10 games/month: **~$10** + operational overhead.

## Key Design Decisions

1. **No Database**: Game state in-memory (50 players = ~1-2 MB RAM). Acceptable for MVP.
2. **HTTP Polling**: Simpler than WebSocket for 50 concurrent users.
3. **Neynar Score > 0.8**: Filters out bots and low-quality accounts upfront.
4. **Claude 3.5 Sonnet**: Best price/performance ratio for impersonation task.
5. **Vercel KV (Phase 3)**: Optional for multi-instance sync if needed later.

## Git Commits

- `b990158`: Phase 1 - Initialize Next.js Farcaster mini app with core game state logic

## Feedback & Adjustments

As we build Phase 2, we may discover:
- Actual Farcaster SDK usage patterns (the docs show multiple approaches)
- Neynar API response formats & latency
- Claude's effectiveness at impersonating diverse writing styles
- HTTP polling latency on mobile (may switch to WebSocket)

These will inform Phase 2-3 refinements.

---

**Ready to start Phase 2?** Build the API routes and React components next.
