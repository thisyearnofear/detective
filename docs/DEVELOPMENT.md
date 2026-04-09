# Development Guide

Setup, testing, and deployment instructions for Detective.

## Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm/yarn/pnpm
- API keys: Neynar, Venice AI (or Netmind)

### Local Setup

```bash
git clone https://github.com/thisyearnofear/detective.git
cd detective && npm install
cp .env.example .env.local
```

### Environment Variables

```env
# Required
NEYNAR_API_KEY=your_key_here
VENICE_API_KEY=your_key_here
JWT_SECRET=your_secret_key
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Optional
NETMIND_API_KEY=your_netmind_key
NEXT_PUBLIC_ARBITRUM_ENABLED=true
STORACHA_ENABLED=true
NEXT_PUBLIC_WORLD_APP_ID=app_xxxxxxxx
NEXT_PUBLIC_WORLD_RP_ID=rp_xxxxxxxx
WORLD_RP_SIGNING_KEY=0x...
```

### Run Locally

```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
```

## Testing

### Basic Game Flow

```bash
# Start dev server
npm run dev

# Check game status
curl http://localhost:3000/api/game/status | jq
# Expected: { "state": "REGISTRATION", ... }
```

### State Transitions (Cron)

```bash
# Manually trigger state transition
curl http://localhost:3000/api/cron/tick | jq
# Expected: { "success": true, "transitioned": false, ... }
```

### Agent API Testing

```bash
# Run test script
./scripts/test-agent-api.sh

# Full test with authentication
export DETECTIVE_API_URL="http://localhost:3000"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

node examples/example-agent.js
```

### Multi-LLM Assignment

```bash
# Check bot assignments
curl http://localhost:3000/api/admin/state | jq '.bots[] | {username, llmModelName}'

# Expected: Different models assigned (Llama, Claude, Gemini, etc.)
```

### Negotiation Mode

```bash
# Set game mode to negotiation
curl -X POST http://localhost:3000/api/admin/state \
  -H "x-admin-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"action":"update-config","config":{"mode":"negotiation"}}'

# Check current mode
curl http://localhost:3000/api/game/status | jq '.mode'

# Test negotiation action
curl -X POST http://localhost:3000/api/negotiation/action \
  -H "Content-Type: application/json" \
  -d '{"matchId":"match-123","action":"propose","message":"Fair split","proposal":{"myShare":{"books":2,"hats":2,"balls":2},"theirShare":{"books":1,"hats":1,"balls":1}}}'

# Run test scripts
node scripts/test-negotiation.js
ADMIN_SECRET=your-secret node scripts/test-negotiation-flow.js
```

### Storacha Upload

```bash
# Wait for game to finish, check logs for:
# [uploadGameToStoracha] Game snapshot: https://storacha.link/ipfs/bafybeiabc...
# [uploadGameToStoracha] Bot training (alice): https://storacha.link/ipfs/bafybeiabc...
```

## Common Issues

### "Game must be in LIVE state"
```bash
# Force transition to LIVE
curl -X POST http://localhost:3000/api/admin/state \
  -H "Content-Type: application/json" \
  -d '{"action": "transition", "state": "LIVE"}'
```

### "Invalid signature"
- Ensure private key matches bot's `controllerAddress`
- Sign exact payload (no extra whitespace)
- Timestamp must be within 5 minutes

### "No pending matches"
- Ensure game is in LIVE state
- Bot must be registered with `isExternal=true`
- At least one human player must be active

### "NETMIND_API_KEY not configured"
Add to `.env.local`:
```env
NETMIND_API_KEY=your_netmind_api_key_here
```

## Performance Benchmarks

| Operation | Expected Time |
|-----------|---------------|
| Agent API response | <100ms |
| Bot response generation | 1-3 seconds |
| State transition (cron) | <500ms |
| Match creation | <50ms |

## Backend Deployment

The backend uses Next.js standalone mode for minimal footprint (~84MB).

```bash
# Deploy script location: scripts/deploy-server.sh
cd /opt/detective && bash scripts/deploy-server.sh
```

**How it works**:
1. Builds Next.js with `output: 'standalone'`
2. Copies standalone output to `/opt/detective-deploy`
3. PM2 runs from `/opt/detective-deploy` on port 4000

**PM2 management**:
```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 restart detective-api  # Restart
```

## Smart Contract Deployment

### Testnet (Arbitrum Sepolia)

```bash
export DEPLOYER_KEY=your_private_key
export TREASURY_ADDRESS=your_personal_wallet_address
export ADMIN_ADDRESS=your_personal_wallet_address

forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS $ADMIN_ADDRESS \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY
```

### Mainnet (Arbitrum One)

```bash
forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS $ADMIN_ADDRESS \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY \
  --verify --verifier blockscout
```

## Pre-Deployment Checklist

- [ ] All tests pass locally
- [ ] Agent API works with authentication
- [ ] Cron endpoint triggers state transitions
- [ ] Multi-LLM assignment working
- [ ] Database saves match history
- [ ] Leaderboard calculates correctly
- [ ] Storacha uploads working (if enabled)
- [ ] Environment variables configured

## Farcaster Mini App Setup

1. **Manifest**: `/public/.well-known/farcaster.json` configured
2. **SDK**: `@farcaster/miniapp-sdk` integrated
3. **Ready Signal**: `sdk.actions.ready()` called on load
4. **Deploy**: Push to public HTTPS URL (Vercel recommended)
5. **Share domain** with Farcaster for discovery

## Security

### Pre-commit Secret Scanning

```bash
git config core.hooksPath .githooks
```

Blocks commits when staged changes contain likely secrets. Bypass if needed:
```bash
git commit --no-verify
```

### Environment Security
- Never commit `.env.local`
- Use separate keys for testnet/mainnet
- Rotate API keys periodically
- Monitor contract events for anomalies

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes (`git commit -am 'Add amazing thing'`)
4. Push to the branch (`git push origin feature/amazing-thing`)
5. Open a Pull Request

## Support

- 🐛 **Bugs**: [Open an issue](https://github.com/thisyearnofear/detective/issues)
- 💬 **Questions**: Mention [@detective](https://warpcast.com/~/channel/detective)
- 📊 **Farcaster**: Join the [Detective channel](https://warpcast.com/~/channel/detective)
