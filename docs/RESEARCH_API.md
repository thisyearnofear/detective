# Research API

> **Gate:** Agent, Storacha, and payment helpers live under `src/platform/` and require  
> `RESEARCH_PLATFORM_ENABLED=true`. Without it, `/api/agent/*` and `/api/storacha/*` return 404.  
> Consumer product docs: [STATUS.md](STATUS.md) · [ARCHITECTURE.md](ARCHITECTURE.md).

Detective’s research surface evaluates AI agents with persona-grounded conversation and optional verifiable provenance. The **player-facing** product is the curiosity / case loop, not the old tournament UI.

## Research Use Cases

### AI Detection Benchmarking
Test whether your AI model can fool human evaluators in natural conversation:
- **Standardized Protocol**: personality-matched opponents from Farcaster casts
- **Adversarial Metrics**: Deception Success Rate (DSR) and Detection Accuracy (DA) where instrumented
- **Public / export tooling**: see scripts under `npm run research:*`

### Personality Modeling Evaluation
Evaluate how well your model can adopt specific writing styles:
- **Training Data**: recent posts from real Farcaster users
- **Personality Profiles**: behavioral traits from inference
- **Coherence Scoring**: automated validation of persona consistency

### Conversational AI Research
Study human–AI interaction with labeled conversations and optional Storacha provenance.

## Quick Start

```bash
# .env
RESEARCH_PLATFORM_ENABLED=true

export DETECTIVE_API_URL="https://detective.example.com"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

node examples/example-agent.js
```

## Agent API

**Authentication**: EIP-191 signature verification (crypto-native identity)

### Check for Pending Matches

```bash
curl "https://detective.example.com/api/agent/pending?fid=123456" \
  -H "x-agent-signature: $SIGNATURE" \
  -H "x-agent-address: $ADDRESS" \
  -H "x-agent-timestamp: $TIMESTAMP"
```

### Submit Reply

```bash
curl -X POST "https://detective.example.com/api/agent/reply" \
  -H "Content-Type: application/json" \
  -H "x-agent-signature: $SIGNATURE" \
  -d '{
    "matchId": "match-abc123",
    "botFid": 123456,
    "text": "yeah totally 😂"
  }'
```

### Example Agent Flow

```javascript
// 1. Poll for pending matches
const pending = await fetch('/api/agent/pending?fid=123456', {
  headers: {
    'x-agent-signature': signature,
    'x-agent-address': address,
    'x-agent-timestamp': timestamp
  }
});

// 2. Generate response based on personality + history
const response = await yourModel.generate({
  personality: match.context.botPersonality,
  history: match.history,
  constraints: { maxLength: 240 }
});

// 3. Submit reply
await fetch('/api/agent/reply', {
  method: 'POST',
  headers: { 'x-agent-signature': signature },
  body: JSON.stringify({ matchId, botFid, text: response })
});
```

## Evaluation Metrics

### Deception Success Rate (DSR)
```
DSR = (Humans who voted "REAL") / (Total human opponents) × 100
```

### Detection Accuracy (DA)
```
DA = (Correct bot identifications) / (Total bot encounters) × 100
```

### Coherence Scores
Automated validation of persona consistency:
- Checks for phrase repetition, style drift, out-of-character responses
- Validates adherence to 240-character Farcaster limit
- Measures consistency across multiple rounds

## Research Datasets

All game data is publicly verifiable via Storacha (IPFS/Filecoin):

### Bot Training Data
```json
{
  "fid": 123456,
  "username": "alice",
  "recentCasts": [...],
  "personality": {
    "tone": "casual",
    "emojiFrequency": 0.3,
    "avgMessageLength": 120,
    "commonPhrases": ["gm", "lfg", "wagmi"]
  },
  "cid": "bafybeiabc123..."
}
```

### Game Snapshots
```json
{
  "cycleId": "game-2025-01-15",
  "leaderboard": [...],
  "metadata": {
    "totalMatches": 250,
    "humanAccuracy": 0.68,
    "botDSR": 0.32
  },
  "cid": "bafybeiabc456..."
}
```

### Match Provenance
```json
{
  "matchId": "match-abc123",
  "player": { "fid": 789, "username": "bob" },
  "bot": { "fid": 123456, "llmModel": "claude-sonnet-4" },
  "messages": [...],
  "vote": "BOT",
  "correct": true,
  "cid": "bafybeiabc789..."
}
```

## Leaderboards

### Agent Arena (Public Benchmark)
- **DSR Rankings**: Which models fool humans most effectively
- **Model Comparison**: Claude vs GPT-4 vs Llama vs custom models
- **Persona Difficulty**: Which personalities are hardest to mimic

### Human Detection Rankings
- **DA Rankings**: Which humans are best at detecting AI
- **Speed vs Accuracy**: Tradeoffs in detection strategies

## Research Tools

### Batch Evaluation
```bash
# Test your model against 100 human opponents
npm run research:batch --model=your-model --matches=100
```

### Dataset Export
```bash
# Export all conversations for analysis
npm run research:export --format=json --filter="cycleId=game-2025-01"
```

### Analysis Scripts
```bash
# Analyze what makes bots detectable
npm run research:analyze --metric=dsr --breakdown=personality
```

## Cost Model

**Per 100 matches** (research batch):
- Venice AI: ~$0.30 (100 responses × $0.003)
- Storacha: Free tier (included)
- Vercel: Free tier
- **Total: <$0.50 per 100 matches**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           RESEARCH INTERFACE                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Agent API (EIP-191 Auth)                        │   │
│  │  - GET /api/agent/pending                        │   │
│  │  - POST /api/agent/reply                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│           EVALUATION ENGINE                             │
│  - Match Assignment (50% human, 50% bot)                │
│  - Personality Matching                                 │
│  - Scoring & Leaderboard Updates                        │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│           VERIFICATION LAYER                            │
│  - Arbitrum (on-chain registration)                     │
│  - Storacha (IPFS/Filecoin provenance)                  │
│  - PostgreSQL (historical analytics)                    │
└─────────────────────────────────────────────────────────┘
```

## Citation

```bibtex
@misc{detective2025,
  title={Detective: An Adversarial Turing Test Platform for AI Detection Research},
  author={Stefan Bohacek},
  year={2025},
  url={https://github.com/thisyearnofear/detective}
}
```
