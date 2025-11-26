# Detective Farcaster Mini App - Development Guide & Implementation

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
- User authentication flow (Farcaster SDK)
- Retrieve user profile (FID, username, pfp)
- List available game cycles (hardcoded initially)

#### Game Registration with Quality Gate

- Registration UI (simple form with "Join" button)
- Quality filter: Call Neynar to validate Farcaster score > 0.8
- Reject if score too low (graceful error)
- Hard cap at 50 registrants per cycle
- Store in-memory: `registeredUsers: Map<FID, UserProfile>`
- Scrape top 30 recent casts via Neynar for each user

#### Chat Interface (HTTP Polling)

- 2-column layout: Messages + opponent responses
- Fake bot responses (Venice AI with hardcoded context initially)
- 4-minute timer countdown
- Real user-to-user messaging via polling (/api/chat/poll)
- In-memory message queue: `messages: Map<matchId, Message[]>`

#### Voting & Basic Scoring

- Vote submission endpoint (/api/vote/submit)
- Calculate accuracy per match (in-memory)
- Simple leaderboard view (computed from in-memory scores)

#### Testing

- End-to-end flow with 2-3 test users
- Verify Neynar score filtering works
- Confirm in-memory state persistence

**Output**: Playable game with Venice bot, working leaderboard, no database

---

### Phase 2: AI Integration & Polish (1 week)

**Goal**: Venice bots feel authentic, game is fun

#### Prompt Engineering

Design system prompt with context injection:

```
You are @${username}. You recently wrote these posts:
${recentCasts}

Your style: ${toneSummary}
Keep responses under 240 chars. Stay in character.
Never say you're an AI. Respond naturally.
```

#### Bot Response Generation

- Implement `/api/chat/send` (handles both users & bots)
- Route to Venice AI if opponent is bot
- Add response caching (same question → cached response)
- Cost tracking in console logs

#### Matching Algorithm

- Pseudorandom user pairing in `getNextMatch()`
- Ensure same user isn't matched twice in same cycle
- 50% real user, 50% bot assignments
- Track match history in-memory

#### User Testing

- Recruit 5-10 Farcaster beta users
- 1-2 game cycles (3-4 hour sessions)
- Collect feedback on bot believability
- Adjust prompts iteratively

#### UI Polish

- Smooth message animations
- Loading states on responses
- Timer visual feedback
- Mobile responsiveness

**Output**: Believable bots, polished MVP, ready for soft launch

---

### Phase 3: Multi-Game Support (1 week, post-soft-launch)

**Goal**: Run repeated game cycles, measure retention

#### Game Lifecycle Management

- Simple admin interface to define game cycles:
  - Registration open/close times
  - Game start/end times
- Cycle state machine: `REGISTRATION` → `LIVE` → `FINISHED`
- Hardcoded initially, can add UI later

#### In-Memory State Persistence

- Consider Vercel KV for multi-instance sync (if Vercel Pro)
- Export final leaderboard as JSON
- Allow users to cast leaderboard results (post-game)

#### Game Results Export

- Generate summary cast: "Final leaderboard: X users, top 5 winners"
- Option for users to share their scores individually
- Track metrics: total accuracy, average rounds played

#### Analytics Lite

- Simple dashboard: players registered, accuracy distribution
- Cost tracking: Neynar API calls, Venice tokens
- Log to console or simple JSON file

#### Security & Rate Limits

- Validate Farcaster SDK message signatures
- Prevent double-voting (in-memory dedup)
- Rate limit: 30 reqs/min per user
- Secure API keys (Vercel env vars)

**Output**: Repeatable game cycles, basic analytics, soft launch ready

---

### Phase 4: Soft Launch (1 week)

**Status**: Production ready with access gating preparation

**Latest Achievements**:
- ✅ Real Farcaster SDK integration with miniapp detection
- ✅ Multi-platform wallet connection (MetaMask, WalletConnect, Farcaster)
- ✅ Real-time registration lobby with player tracking
- ✅ Multi-chain leaderboard system (Arbitrum + Monad)
- ✅ Bot response optimization (eliminated 1-23 second delays)
- ✅ Mobile-first design for Farcaster clients
- 🔄 Access gating implementation (NFT/token requirements)

**Goal**: Launch gated access with multi-chain economics

#### Final UI Polish

- Mobile-first responsive design (Warpcast is mobile-first)
- Error messages & edge cases
- Loading states on all API calls
- Graceful degradation if APIs fail

#### Leaderboard & Results

- Live leaderboard during game
- Final results screen with accuracy stats
- Share button: "I got X% correct on @detective"
- User-specific stats

#### Public Launch Prep

- Production deployment (Vercel)
- Announce in Farcaster channels
- Invite first 50 beta users

#### Monitoring

- Log API errors & response times
- Track costs (Neynar, Venice)
- Monitor Vercel function execution

**Output**: First playable public game, data on user retention

---

### Phase 5: Growth & Refinement (Post-Soft-Launch)

**Goal**: Repeat players, refined core loop

#### Iterative Improvements

- Adjust match timing based on feedback (3-4 min sweet spot?)
- Refine Claude prompts based on user comments
- Add 2-3 more game cycles (weekly)
- Measure retention: % of users returning for cycle 2+

#### Optional Enhancements

- Achievements/badges (simple SVG in UI)
- Seasonal themes or special events
- Leaderboard persistence (lightweight: JSON export)
- User profiles with historical stats

#### Community & Monetization (TBD)

- Dedicated Farcaster channel (@detective)
- Eventual NFT for top scorers (post-Phase 5)
- Potential Farcaster grants or ecosystem partnerships

**Output**: Sustainable game loop, repeat-play data, roadmap to scale

---

## Implementation Details

### Core Game State Store (`gameState.ts`)

- In-memory data structures for users, games, matches, messages, votes
- Leaderboard calculation using accuracy and speed metrics
- Match creation & message handling
- No database required (state persists during game cycle only)

### Neynar Integration (`neynar.ts`)

- Fetch user profiles by FID
- Retrieve recent casts for context injection
- Neynar score validation (> 0.8 quality filter)
- Bulk user fetching

### Venice AI Bot Logic (`inference.ts`)

- Generate context-aware bot responses
- System prompt injection with user's recent posts
- Response validation & tone extraction
- Privacy-first; OpenAI-compatible client

---

## Running Locally

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm/yarn/pnpm
- API keys:
  - [Neynar](https://neynar.com/app/api-keys)
  - [Venice AI](https://venice.ai/)

### Setup

1. Clone and install:

   ```bash
   git clone https://github.com/thisyearnofear/detective.git
   cd detective
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env.local
   ```

   Then add your API keys to `.env.local`:

   ```
   NEYNAR_API_KEY=your_key_here
   ANTHROPIC_API_KEY=your_key_here
   ```

3. Run locally:

   ```bash
   npm run dev
   # Visit http://localhost:3000
   ```

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

---

## Environment Variables (.env.local)

```
# Farcaster Mini App SDK
NEXT_PUBLIC_FARCASTER_HUB_URL=https://hub.farcaster.xyz

# Neynar API
NEYNAR_API_KEY=your_neynar_key

# Venice AI
VENICE_API_KEY=your_venice_key

# Optional: Vercel KV (Phase 3+)
# KV_URL=...
# KV_REST_API_TOKEN=...

# Optional: Error tracking
# SENTRY_DSN=...
```

---

## Costs (Estimated)

### Per game cycle (50 players, 5 rounds each = 250 bot responses):

- Neynar API: Free tier (~200 API calls well under 10k/day limit)
- Venice AI: low per-game cost at this scale
- Vercel: Free tier
- **Total: <$1/game**

### Monthly Budget (10 games/month):

- **~$10** + operational overhead

---

## Open Questions & Decisions

1. **Matching Strategy**: How do we handle odd player counts? Keep bots in rotation?
   - _Suggested_: Odd players always match with a bot
2. **Chat Duration**: 3-5 minutes seems right, but validate?
   - _Suggested_: Start with 4 minutes, allow admin override
3. **Rounds Per Game**: 3-5 matches per player per cycle?
   - _Suggested_: 5 rounds for depth, but make configurable
4. **Revenue Model**: Are we monetizing? If yes, when?
   - _Suggested_: Phase 2-3 assessment; start with engagement focus
5. **Moderation**: Who flags inappropriate messages?
   - _Suggested_: Auto-flag certain words, human review in Phase 3+
6. **Bot Training Data**: Fresh scrape per game or cached profiles?
   - _Suggested_: Fresh scrape (24h cache) to capture latest user tone

---

## Rollout Plan

### Week 1-2 (Internal Test)

- Deploy MVP to private channel
- 5-10 internal testers
- Gather feedback

### Week 3-4 (Beta / Trusted Users)

- Invite 100-200 trusted Farcaster users
- Monitor for bugs, costs
- Refine bot prompts

### Week 5+ (Public Launch)

- Announce in `@detective` channel
- First game cycle: 24-48 hour duration
- Aim for 500-1,000 registrations
- Iterate on feedback

---

## Risk & Mitigation Summary

| Risk                             | Impact | Likelihood | Mitigation                                                  |
| -------------------------------- | ------ | ---------- | ----------------------------------------------------------- |
| Neynar API rate limits (10k/day) | Medium | Low        | 50 players = ~200 reqs/game. Monitor, upgrade if needed.    |
| Venice AI costs escalate         | Low    | Low        | ~$1-2/game for 50 players. Budget $50-100/month.            |
| Bot responses not believable     | High   | Medium     | Iterate prompts per cycle, A/B test with feedback.          |
| User churn after first cycle     | High   | Medium     | Make cycle 2 registration easy, social sharing.             |
| Game state lost on crash         | Medium | Low        | Acceptable for MVP; restart game. Add Vercel KV in Phase 3. |
| Farcaster SDK changes            | Medium | Low        | Pin versions, follow @farcaster/miniapps releases.          |

---

## Migration Summary (Phase 1 Complete ✓)

Successfully migrated Detective from a legacy Express.js + jQuery + MySQL application into a modern **Farcaster-native mini app** built with Next.js 15, TypeScript, and React 19.

### Code Cleanup

- **Archived** old codebase in `/archived` directory (Express.js, Gulp, views, db schema, etc.)
- **Removed** 2010s dependencies (old gulp plugins, MySQL, passport-twitter, socket.io, etc.)

### Build Status

✅ TypeScript compilation successful
✅ Next.js build passes (production-ready)
✅ Git initialized with Phase 1 commit

### Next Steps: Phase 2 (1 week)

#### API Routes (status)

- [x] `/api/game/register` - User registration with Neynar score check
- [x] `/api/game/status` - Current game state
- [x] `/api/game/cycles` - List available game cycles
- [x] `/api/match/next` - Get next opponent (real player or bot)
- [x] `/api/chat/send` - Send message (relay or generate bot response)
- [x] `/api/chat/poll` - Poll for new messages
- [x] `/api/vote/submit` - Submit guess and calculate score
- [x] `/api/leaderboard/current` - Get live leaderboard

#### React Components (status)

- [x] `GameRegister.tsx` - Registration form with quality check
- [x] `ChatWindow.tsx` - Real-time chat interface (HTTP polling)
- [x] `VotingPanel.tsx` - Real/Bot selection UI
- [x] `Leaderboard.tsx` - Rankings display
- [x] `Timer.tsx` - 4-minute match countdown
- [x] `GameStatus.tsx` - Current game cycle info

#### Prompt Engineering

- Refine Venice system prompt for user impersonation
- Test with 5-10 beta users
- Iterate based on bot believability feedback

#### Testing

- End-to-end: register → match → chat → vote
- Neynar API rate limiting
- Venice AI cost tracking
- Message persistence in-memory

---

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes (`git commit -am 'Add amazing thing'`)
4. Push to the branch (`git push origin feature/amazing-thing`)
5. Open a Pull Request

---

## Support

- 🐛 **Bugs**: [Open an issue](https://github.com/thisyearnofear/detective/issues)
- 💬 **Questions**: Tweet [@stefanbohacek](https://warpcast.com/stefan) or mention [@detective](https://warpcast.com/~/channel/detective)
- 📊 **Farcaster**: Join the [Detective channel](https://warpcast.com/~/channel/detective)

---

## Acknowledgments

- Original Detective game concept: [Stefan Bohacek](https://stefanbohacek.online/)
- Farcaster mini app infrastructure
- Neynar API & community
- Venice AI for the AI brain