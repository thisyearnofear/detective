# Detective @ Optimization Arena Hackathon

## One-Line Pitch
**Automated research harness for benchmarking AI agents in adversarial Turing tests with verifiable on-chain provenance.**

## Problem
As AI models become indistinguishable from humans, we need standardized benchmarks to:
1. Evaluate AI detection capabilities
2. Measure personality modeling accuracy
3. Study human-AI interaction patterns

Current solutions lack:
- Standardized evaluation protocols
- Verifiable provenance
- Real-world adversarial conditions

## Solution
Detective provides a production-ready research platform where:
1. **Researchers submit AI agents** via crypto-native API (EIP-191 auth)
2. **Agents face human evaluators** in 4-minute conversations
3. **Results are verifiable** via Arbitrum + Storacha (IPFS/Filecoin)

## Key Metrics

### Deception Success Rate (DSR)
```
DSR = (Humans who voted "REAL") / (Total human opponents) × 100
```
Primary benchmark for AI quality.

### Detection Accuracy (DA)
```
DA = (Correct bot identifications) / (Total bot encounters) × 100
```
Measures human detection capability.

### Coherence Score
Automated validation of persona consistency (style drift, phrase repetition, etc.)

## Technical Architecture

```
Research Interface (Agent API)
    ↓
Evaluation Engine (Match Assignment + Scoring)
    ↓
Verification Layer (Arbitrum + Storacha + PostgreSQL)
```

### Tech Stack
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Backend**: Next.js API Routes (serverless)
- **Blockchain**: Arbitrum One (on-chain registration)
- **Storage**: Storacha (IPFS/Filecoin provenance)
- **AI**: Venice AI, OpenRouter (multi-LLM support)
- **Auth**: EIP-191 signature verification

## Research Use Cases

### 1. AI Detection Benchmarking
Test whether your model can fool human evaluators:
- Standardized 4-minute conversation protocol
- Personality-matched opponents
- Public leaderboard (Claude vs GPT-4 vs Llama vs custom)

### 2. Personality Modeling Evaluation
Evaluate persona adoption accuracy:
- Training data: 30 recent posts from real users
- 20+ behavioral traits (tone, emoji, capitalization)
- Coherence scoring for style consistency

### 3. Conversational AI Research
Study interaction patterns:
- Thousands of labeled human-AI conversations
- Ground truth labels (human/bot)
- Verifiable provenance via Storacha

## Quick Start for Researchers

```bash
# 1. Install SDK
npm install @detective/agent-sdk

# 2. Configure agent
export DETECTIVE_API_URL="https://detective.example.com"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

# 3. Run batch evaluation
npm run research:batch --model=your-model --matches=100

# 4. Export results
npm run research:export --format=json

# 5. Analyze patterns
npm run research:analyze --metric=dsr --breakdown=model
```

## Agent API

### Authentication
EIP-191 signature verification (crypto-native identity)

### Endpoints
- `GET /api/agent/pending?fid={botFid}` - Check for pending matches
- `POST /api/agent/reply` - Submit bot response

### Example Flow
```javascript
// 1. Poll for pending matches
const pending = await fetch('/api/agent/pending?fid=123456', {
  headers: {
    'x-agent-signature': signature,
    'x-agent-address': address,
    'x-agent-timestamp': timestamp
  }
});

// 2. Generate response
const response = await yourModel.generate({
  personality: match.context.botPersonality,
  history: match.history
});

// 3. Submit reply
await fetch('/api/agent/reply', {
  method: 'POST',
  headers: { 'x-agent-signature': signature },
  body: JSON.stringify({
    matchId: match.matchId,
    botFid: 123456,
    text: response
  })
});
```

## Verifiable Provenance

All game data stored on Storacha (IPFS/Filecoin):

### Bot Training Data
```json
{
  "fid": 123456,
  "username": "alice",
  "recentCasts": [...],
  "personality": { "tone": "casual", "emojiFrequency": 0.3 },
  "cid": "bafybeiabc123..."
}
```

### Game Snapshots
```json
{
  "cycleId": "game-2025-01-15",
  "leaderboard": [...],
  "metadata": { "totalMatches": 250, "humanAccuracy": 0.68 },
  "cid": "bafybeiabc456..."
}
```

### Match Provenance
```json
{
  "matchId": "match-abc123",
  "player": { "fid": 789 },
  "bot": { "fid": 123456, "llmModel": "claude-sonnet-4" },
  "messages": [...],
  "vote": "BOT",
  "correct": true,
  "cid": "bafybeiabc789..."
}
```

## Cost Model

**Per 100 matches**:
- Venice AI: ~$0.30 (100 responses × $0.003)
- Storacha: Free tier
- Vercel: Free tier
- **Total: <$0.50 per 100 matches**

Extremely cost-effective for large-scale research.

## Current Status

### Production Ready ✅
- 50+ concurrent players supported
- Multi-LLM support (Venice AI, OpenRouter, Claude, GPT-4)
- Crypto-native auth (EIP-191 signatures)
- Verifiable provenance (Storacha integration)
- Public leaderboards (human + agent rankings)

### Research Tools ✅
- Batch evaluation script
- Dataset export (JSON/CSV)
- Analysis tools (DSR breakdown, detection patterns)
- Agent API documentation

### Deployed Infrastructure ✅
- Smart contract on Arbitrum One: `0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff`
- Storacha space: Active with game provenance
- PostgreSQL: Historical analytics
- Redis: Real-time game state

## Hackathon Fit

### Project Track: Automated Research ✅
- **Challenge Harness**: Standardized evaluation protocol
- **Tooling**: Batch testing, export, analysis scripts
- **Agents**: Multi-LLM support with external agent API
- **Evals**: DSR, DA, coherence scoring

### Prizes Target
1. **Top Leaderboard Submission** ($1k): Best DSR during hackathon
2. **Project Track** ($1k): Research tooling contribution
3. **In-Person Presentation** (4 PM): Live demo + results

## Demo Plan

### 1. Live Agent Submission (5 min)
- Show researcher submitting custom agent via API
- Real-time match assignment
- Bot conversation with human evaluator

### 2. Results Dashboard (3 min)
- Public leaderboard (Claude vs GPT-4 vs custom)
- DSR breakdown by model
- Detection patterns analysis

### 3. Verifiable Provenance (2 min)
- Show Storacha CID for game data
- Verify training data on IPFS
- Demonstrate tamper-proof results

## Competitive Advantages

1. **Production Ready**: Not a prototype, already deployed with real users
2. **Verifiable**: On-chain + IPFS provenance (unique in space)
3. **Cost-Effective**: <$0.50 per 100 matches
4. **Standardized**: Clear evaluation protocol + public leaderboard
5. **Multi-LLM**: Test any model via OpenRouter integration

## Next Steps

### Before Challenge Release
- [x] Research harness documentation
- [x] Batch evaluation script
- [x] Export/analysis tools
- [ ] Example agent implementation
- [ ] Video demo recording

### During Hackathon
- [ ] Run live evaluation with participants
- [ ] Collect 1000+ matches for dataset
- [ ] Publish leaderboard results
- [ ] Present findings at 4 PM

## Links

- **GitHub**: [github.com/thisyearnofear/detective](https://github.com/thisyearnofear/detective)
- **Docs**: [docs/RESEARCH_HARNESS.md](RESEARCH_HARNESS.md)
- **Contract**: [Arbitrum Blockscout](https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff)
- **Farcaster**: [@detective](https://warpcast.com/~/channel/detective)

## Contact

- **Builder**: Stefan Bohacek
- **Email**: stefan@stefanbohacek.com
- **Farcaster**: [@stefan](https://warpcast.com/stefan)

---

**Built for Optimization Arena. Made with ❤️**
