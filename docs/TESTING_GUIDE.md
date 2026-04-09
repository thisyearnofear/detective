# Detective Testing Guide

Quick guide to test the platform before the hackathon.

## Prerequisites

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Add your API keys to .env.local:
# - NEYNAR_API_KEY
# - VENICE_API_KEY (or NETMIND_API_KEY)
# - UPSTASH_REDIS_REST_URL
# - UPSTASH_REDIS_REST_TOKEN
# - DATABASE_URL
```

## Test 1: Basic Game Flow

```bash
# Start the dev server
npm run dev

# In another terminal, check game status
curl http://localhost:3000/api/game/status | jq

# Expected: { "state": "REGISTRATION", ... }
```

## Test 2: State Transitions (Cron)

```bash
# Manually trigger state transition
curl http://localhost:3000/api/cron/tick | jq

# Expected: { "success": true, "transitioned": false, ... }
```

## Test 3: Agent API (Basic)

```bash
# Run the test script
./scripts/test-agent-api.sh

# This will:
# - Check game status
# - Test authentication (should fail without signature)
# - Verify cron endpoint
# - Show instructions for full test
```

## Test 4: Agent API (Full with Authentication)

### Step 1: Generate a test wallet

```bash
# Using Node.js
node -e "const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts'); const pk = generatePrivateKey(); const account = privateKeyToAccount(pk); console.log('Private Key:', pk); console.log('Address:', account.address);"
```

### Step 2: Register an external bot

```bash
# Start game in LIVE mode first
# Then register a bot via API or admin panel
# Set isExternal=true and controllerAddress=<your_wallet_address>
```

### Step 3: Run the example agent

```bash
export DETECTIVE_API_URL="http://localhost:3000"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

node examples/example-agent.js
```

Expected output:
```
🤖 Detective Research Agent
===========================
API URL: http://localhost:3000
Bot FID: 123456
Wallet: 0x...

🚀 Agent started. Polling for matches...
.....
📝 Found 1 pending match(es)

🎮 Match 1: match-abc123
   Opponent: alice
   Round: 1
   Messages: 2
   Response: "yeah totally 😂"
   ✅ Reply submitted
```

## Test 5: Netmind AI Integration

```bash
# Add to .env.local
NETMIND_API_KEY=your_netmind_api_key_here

# Test Netmind API directly
curl https://api.netmind.ai/inference-api/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_NETMIND_API_KEY" \
  -d '{
    "model": "meta-llama/Meta-Llama-3.3-70B-Instruct",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Say hello in 5 words"}
    ],
    "max_tokens": 50
  }'
```

Expected response:
```json
{
  "choices": [
    {
      "message": {
        "content": "Hello there, how are you?"
      }
    }
  ]
}
```

## Test 6: Multi-LLM Assignment

Check that bots are assigned different LLMs:

```bash
# Register multiple players
# Check bot assignments in admin panel or via API

curl http://localhost:3000/api/admin/state | jq '.bots[] | {username, llmModelName}'
```

Expected output:
```json
{"username": "alice", "llmModelName": "Llama 3.3 70B (Netmind)"}
{"username": "bob", "llmModelName": "Claude Haiku 4.5"}
{"username": "charlie", "llmModelName": "Gemini 3 Flash"}
```

## Test 7: Storacha Upload (Optional)

If Storacha is enabled:

```bash
# Wait for game to finish
# Check logs for upload confirmation

# Expected in logs:
# [uploadGameToStoracha] Game snapshot: https://storacha.link/ipfs/bafybeiabc...
# [uploadGameToStoracha] Bot training (alice): https://storacha.link/ipfs/bafybeiabc...
```

## Common Issues

### Issue: "Game must be in LIVE state"
**Solution**: Wait for countdown or force transition:
```bash
curl -X POST http://localhost:3000/api/admin/state \
  -H "Content-Type: application/json" \
  -d '{"action": "transition", "state": "LIVE"}'
```

### Issue: "Invalid signature"
**Solution**: Check that:
- Private key matches bot's controllerAddress
- Signing the exact payload (no extra whitespace)
- Timestamp is within 5 minutes

### Issue: "No pending matches"
**Solution**: 
- Ensure game is in LIVE state
- Bot must be registered with isExternal=true
- At least one human player must be active

### Issue: "NETMIND_API_KEY not configured"
**Solution**: Add to .env.local:
```bash
NETMIND_API_KEY=your_netmind_api_key_here
```

## Performance Benchmarks

Expected performance:
- Agent API response time: <100ms
- Bot response generation: 1-3 seconds
- State transition (cron): <500ms
- Match creation: <50ms

## Pre-Hackathon Checklist

- [ ] All tests pass locally
- [ ] Agent API works with authentication
- [ ] Netmind AI integration working
- [ ] Cron endpoint triggers state transitions
- [ ] Storacha uploads working (if enabled)
- [ ] Example agent runs successfully
- [ ] Multi-LLM assignment working
- [ ] Database saves match history
- [ ] Leaderboard calculates correctly

## Deployment Testing

After deploying to Vercel:

```bash
# Test production API
export DETECTIVE_API_URL="https://your-app.vercel.app"
./scripts/test-agent-api.sh

# Test cron (should run automatically every 30 seconds)
# Check Vercel logs for cron execution
```

## Support

If tests fail:
1. Check logs: `npm run dev` output
2. Verify environment variables in .env.local
3. Check Redis connection: `npm run test:redis`
4. Check database: `npm run test:database`
5. Open an issue on GitHub with error details
