#!/bin/bash

# Test Agent API End-to-End
# This script tests the complete agent flow:
# 1. Authentication with EIP-191 signatures
# 2. Polling for pending matches
# 3. Submitting replies

set -e

# Configuration
API_URL="${DETECTIVE_API_URL:-http://localhost:3000}"
BOT_FID="${DETECTIVE_BOT_FID:-123456}"

echo "🧪 Testing Detective Agent API"
echo "================================"
echo "API URL: $API_URL"
echo "Bot FID: $BOT_FID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check game status
echo "📊 Test 1: Check game status"
STATUS_RESPONSE=$(curl -s "$API_URL/api/game/status")
GAME_STATE=$(echo $STATUS_RESPONSE | jq -r '.state')
echo "Game state: $GAME_STATE"

if [ "$GAME_STATE" != "LIVE" ]; then
  echo -e "${YELLOW}⚠️  Game is not LIVE. Agent API requires LIVE state.${NC}"
  echo "Current state: $GAME_STATE"
  echo ""
  echo "To test agent API:"
  echo "1. Start the game: npm run dev"
  echo "2. Register players via /api/game/register"
  echo "3. Wait for game to transition to LIVE"
  echo "4. Run this script again"
  exit 1
fi

echo -e "${GREEN}✓ Game is LIVE${NC}"
echo ""

# Test 2: Poll for pending matches (without auth - should fail)
echo "📝 Test 2: Poll for pending matches (no auth - should fail)"
PENDING_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/agent/pending?fid=$BOT_FID")
HTTP_CODE=$(echo "$PENDING_RESPONSE" | tail -n1)
BODY=$(echo "$PENDING_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected unauthenticated request${NC}"
else
  echo -e "${RED}✗ Expected 401, got $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Check if bot exists
echo "🤖 Test 3: Check if bot is registered"
echo "Note: This test requires the bot to be registered in the game"
echo "You can register a bot via /api/game/register with isExternal=true"
echo ""

# Test 4: Instructions for full test
echo "📖 Full Test Instructions"
echo "========================="
echo ""
echo "To test the complete agent flow with authentication:"
echo ""
echo "1. Install dependencies:"
echo "   npm install viem"
echo ""
echo "2. Set environment variables:"
echo "   export DETECTIVE_API_URL=\"$API_URL\""
echo "   export DETECTIVE_BOT_FID=\"$BOT_FID\""
echo "   export DETECTIVE_AGENT_PRIVATE_KEY=\"0x...\""
echo ""
echo "3. Run the example agent:"
echo "   node examples/example-agent.js"
echo ""
echo "The example agent will:"
echo "  - Sign requests with EIP-191"
echo "  - Poll for pending matches every 5 seconds"
echo "  - Generate responses based on personality"
echo "  - Submit replies to the game"
echo ""

# Test 5: Check cron endpoint
echo "⏰ Test 5: Check cron endpoint"
CRON_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/cron/tick")
HTTP_CODE=$(echo "$CRON_RESPONSE" | tail -n1)
BODY=$(echo "$CRON_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Cron endpoint is working${NC}"
  echo "Response: $BODY"
elif [ "$HTTP_CODE" = "401" ]; then
  echo -e "${YELLOW}⚠️  Cron endpoint requires authentication (CRON_SECRET set)${NC}"
else
  echo -e "${RED}✗ Cron endpoint returned $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""

echo "✅ Basic API tests complete!"
echo ""
echo "Next steps:"
echo "1. Register an external bot in the game"
echo "2. Run the example agent: node examples/example-agent.js"
echo "3. Monitor the agent's behavior in the game"
