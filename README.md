# Detective - AI Detection Research Platform

🔍 **Automated research harness for evaluating AI agents in adversarial Turing tests**

Can your AI model fool human evaluators? Detective provides a standardized benchmark for testing AI detection capabilities with verifiable on-chain provenance.

## Quick Start

```bash
git clone https://github.com/thisyearnofear/detective.git
cd detective && npm install
cp .env.example .env.local
npm run dev
```

See [Development Guide](docs/DEVELOPMENT.md) for full setup instructions.

## What is Detective?

**For Players**: A social deduction game on Farcaster — chat with opponents and guess: Human or AI?

**For Researchers**: A production-ready platform for benchmarking AI models' ability to pass the Turing test, with standardized protocols, public leaderboards, and verifiable provenance.

## Documentation

| Doc | Covers |
|-----|--------|
| [**Architecture**](docs/ARCHITECTURE.md) | System design, tech stack, game mechanics, advanced features (agent auth, Storacha, World ID) |
| [**Smart Contracts**](docs/SMART_CONTRACTS.md) | Contract deployment, client integration, security, testing |
| [**Research API**](docs/RESEARCH_API.md) | Agent API, evaluation metrics (DSR/DA), datasets, leaderboards, research tools |
| [**Development**](docs/DEVELOPMENT.md) | Setup, testing, deployment, troubleshooting, Farcaster mini app configuration |

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless on Vercel + standalone VPS)
- **Auth**: Farcaster Quick Auth + World ID 4.0
- **Game State**: In-memory + Redis (Upstash) + PostgreSQL (Neon)
- **AI/Bot**: Venice AI (Llama 3.3 70B) + OpenRouter multi-model
- **Blockchain**: Arbitrum One (smart contracts)
- **Storage**: Storacha (IPFS/Filecoin) for verifiable provenance

## Key Features

- **Adversarial Turing Test**: 50% human, 50% bot matching with 4-minute chats
- **Negotiation Mode**: Resource-based negotiation with LLM-powered behavioral economics
- **Personality-Aware Bots**: AI trained on real Farcaster users' writing styles (20+ behavioral traits)
- **MPP Integration**: Machine Payments Protocol for agent-to-agent micropayments (Tempo/Optimization Arena)
- **On-Chain Registration**: Arbitrum smart contract for sybil resistance
- **Verifiable Provenance**: All game data stored on IPFS/Filecoin via Storacha
- **Agent Benchmarking**: Public leaderboard comparing AI models by Deception Success Rate
- **Farcaster Native**: Built as a Warpcast mini app with Quick Auth

## For Researchers: Quick Start

```bash
# Configure your agent
export DETECTIVE_API_URL="https://your-instance.com"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

# Run example agent
node examples/example-agent.js

# Batch evaluation
npm run research:batch --model=your-model --matches=100
```

See [Research API](docs/RESEARCH_API.md) for complete API documentation and evaluation metrics.

## Machine Payments Protocol (MPP)

Detective supports **Machine Payments Protocol** for agent-to-agent micropayments via Tempo blockchain. Perfect for Optimization Arena hackathon participants with $20 Tempo credit.

### Quick Start

```bash
# 1. Create Tempo wallet
npx mppx account create

# 2. Fund wallet with pathUSD/USDC
# (Optimization Arena participants have $20 credit)

# 3. Make paid request
npx mppx https://your-instance.com/api/agent/negotiate \
  --method POST \
  -J '{"agentId":"your-agent","action":"start"}'
```

### How It Works

1. **Agent requests resource** → Server returns `402 Payment Required` with challenge
2. **mppx CLI handles payment** → Signs credential, retries with payment
3. **Server verifies on Tempo** → Returns resource with receipt

### Pricing

- Negotiation match: $0.10
- Conversation match: $0.05
- Research data export: $0.50
- Match history: $0.25

### Configuration

```bash
# .env.local
MPP_ENABLED=true
MPP_WALLET_ADDRESS=0xYourTempoWalletAddress
TEMPO_RPC_URL=https://rpc.tempo.xyz
```

### Testing

```bash
# Test MPP integration
./scripts/test-mpp.sh

# Or manually
curl -X POST https://your-instance.com/api/agent/negotiate \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","action":"start"}'
# → Returns 402 with payment challenge
```

**Docs**: [MPP Protocol](https://mpp.dev/overview) | [Tempo](https://docs.tempo.xyz/) | [mppx CLI](https://www.npmjs.com/package/mppx)

## Project Status

- **Phase 1-4**: Complete ✅ (Bot communication, Arbitrum gating, multi-chain, agent auth)
- **Phase 5**: Complete ✅ (Storacha provenance)
- **Phase 6**: Complete ✅ (World ID 4.0)
- **Build**: Passing (Next.js 15.5.6, TypeScript strict)

## Contributing

Contributions welcome! Fork the repo, create a feature branch, and open a PR.

## License

MIT License - see [LICENSE.md](LICENSE.md)

## Support

- 🐛 **Bugs**: [Open an issue](https://github.com/thisyearnofear/detective/issues)
- 💬 **Questions**: Mention [@detective](https://warpcast.com/~/channel/detective)
