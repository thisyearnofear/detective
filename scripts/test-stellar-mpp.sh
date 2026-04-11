#!/bin/bash
# Test Stellar MPP Integration
# 
# This script tests the Stellar payment flow for agent API endpoints
# 
# Usage:
#   ./scripts/test-stellar-mpp.sh [endpoint-url]
#
# Example:
#   ./scripts/test-stellar-mpp.sh http://localhost:3000/api/agent/negotiate

set -e

# Configuration
ENDPOINT="${1:-http://localhost:3000/api/agent/negotiate}"
AGENT_ID="test-stellar-agent-$(date +%s)"

echo "================================================"
echo "Testing Stellar MPP Integration"
echo "================================================"
echo ""
echo "Endpoint: $ENDPOINT"
echo "Agent ID: $AGENT_ID"
echo ""

# Test 1: Request without payment (should return 402)
echo "Test 1: Request without payment credential"
echo "-------------------------------------------"
echo "Expected: 402 Payment Required with Stellar provider option"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT_ID\",\"action\":\"start\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" != "402" ]; then
  echo "❌ FAILED: Expected 402, got $HTTP_CODE"
  exit 1
fi

# Check if Stellar is listed as a provider
if echo "$BODY" | grep -q "stellar"; then
  echo "✅ PASSED: Stellar provider found in 402 response"
else
  echo "⚠️  WARNING: Stellar provider not found (may not be enabled)"
fi

echo ""
echo "================================================"
echo "Test 2: Request with mock Stellar payment"
echo "================================================"
echo ""
echo "Note: This test uses a mock payment credential."
echo "In production, you would:"
echo "  1. Create a Stellar wallet"
echo "  2. Fund it with USDC"
echo "  3. Send payment to Detective's Stellar wallet"
echo "  4. Include the transaction hash in Authorization header"
echo ""

# Mock payment credential (will fail verification in production)
MOCK_TX_HASH="stellar-test-$(date +%s)"
MOCK_TIMESTAMP=$(date +%s)000
MOCK_AMOUNT="0.10"

AUTH_HEADER="Payment txHash=$MOCK_TX_HASH amount=$MOCK_AMOUNT timestamp=$MOCK_TIMESTAMP provider=stellar"

echo "Authorization Header: $AUTH_HEADER"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_HEADER" \
  -d "{\"agentId\":\"$AGENT_ID\",\"action\":\"start\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ PASSED: Payment accepted (dev mode or testnet)"
  echo ""
  echo "Match created successfully!"
  echo "Match ID: $(echo "$BODY" | jq -r '.matchId' 2>/dev/null || echo 'N/A')"
  echo "Payment ID: $(echo "$BODY" | jq -r '.paymentId' 2>/dev/null || echo 'N/A')"
elif [ "$HTTP_CODE" = "402" ]; then
  echo "⚠️  Payment verification failed (expected in production without real Stellar tx)"
  echo "Error: $(echo "$BODY" | jq -r '.error' 2>/dev/null || echo 'N/A')"
else
  echo "❌ FAILED: Unexpected status code $HTTP_CODE"
fi

echo ""
echo "================================================"
echo "Integration Test Summary"
echo "================================================"
echo ""
echo "To test with real Stellar payments:"
echo ""
echo "1. Enable Stellar MPP in .env.local:"
echo "   STELLAR_MPP_ENABLED=true"
echo "   STELLAR_WALLET_ADDRESS=GYourWalletAddress"
echo "   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org"
echo "   STELLAR_NETWORK=TESTNET"
echo ""
echo "2. Create a Stellar testnet wallet:"
echo "   - Use Freighter wallet extension"
echo "   - Or stellar-sdk: https://developers.stellar.org/docs"
echo ""
echo "3. Fund wallet with testnet USDC:"
echo "   - Use Stellar Laboratory: https://laboratory.stellar.org"
echo "   - Or testnet faucet"
echo ""
echo "4. Send 0.10 USDC to Detective's wallet"
echo ""
echo "5. Get transaction hash and retry this test with real credentials"
echo ""
echo "Resources:"
echo "  - Stellar Docs: https://developers.stellar.org/docs"
echo "  - Horizon API: https://developers.stellar.org/api"
echo "  - stellar-mpp-sdk: https://github.com/stellar/stellar-mpp-sdk"
echo ""
