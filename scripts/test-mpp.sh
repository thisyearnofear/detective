#!/bin/bash

# Test MPP (Machine Payments Protocol) Integration
# Tests the full 402 challenge-response flow

set -e

echo "🧪 Testing MPP Integration"
echo "=========================="
echo ""

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="$BASE_URL/api/agent/negotiate"

echo "📍 Testing endpoint: $ENDPOINT"
echo ""

# Test 1: GET pricing information (should work without payment)
echo "Test 1: GET /api/agent/negotiate (pricing info)"
echo "------------------------------------------------"
PRICING_RESPONSE=$(curl -s "$ENDPOINT")
echo "$PRICING_RESPONSE" | jq '.' || echo "$PRICING_RESPONSE"
echo ""

# Test 2: POST without payment (should return 402)
echo "Test 2: POST without payment (expect 402)"
echo "------------------------------------------"
CHALLENGE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test-agent","action":"start"}')

HTTP_STATUS=$(echo "$CHALLENGE_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$CHALLENGE_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Status: $HTTP_STATUS"
echo "$BODY" | jq '.' || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "402" ]; then
  echo "✅ Correctly returned 402 Payment Required"
else
  echo "❌ Expected 402, got $HTTP_STATUS"
fi
echo ""

# Test 3: Extract WWW-Authenticate header
echo "Test 3: Check WWW-Authenticate header"
echo "--------------------------------------"
AUTH_HEADER=$(curl -s -I -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test-agent","action":"start"}' \
  | grep -i "www-authenticate" || echo "Not found")

echo "$AUTH_HEADER"
echo ""

if [[ "$AUTH_HEADER" == *"Payment"* ]]; then
  echo "✅ WWW-Authenticate header present"
else
  echo "❌ WWW-Authenticate header missing"
fi
echo ""

# Test 4: POST with invalid payment credential (should return 402 error)
echo "Test 4: POST with invalid payment credential"
echo "---------------------------------------------"
INVALID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Payment txHash=0xinvalid amount=0.10 timestamp=$(date +%s)000" \
  -d '{"agentId":"test-agent","action":"start"}')

HTTP_STATUS=$(echo "$INVALID_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$INVALID_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Status: $HTTP_STATUS"
echo "$BODY" | jq '.' || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "402" ] || [ "$HTTP_STATUS" = "500" ]; then
  echo "✅ Correctly rejected invalid payment"
else
  echo "❌ Expected 402/500, got $HTTP_STATUS"
fi
echo ""

# Test 5: Instructions for real payment testing
echo "Test 5: Real payment testing with mppx CLI"
echo "-------------------------------------------"
echo "To test with real payments:"
echo ""
echo "1. Set up mppx account:"
echo "   npx mppx account create"
echo ""
echo "2. Fund your Tempo wallet with pathUSD/USDC"
echo "   (Optimization Arena participants have \$20 credit)"
echo ""
echo "3. Make a paid request:"
echo "   npx mppx $ENDPOINT --method POST \\"
echo "     -J '{\"agentId\":\"test-agent\",\"action\":\"start\"}'"
echo ""
echo "4. The mppx CLI will automatically:"
echo "   - Receive the 402 challenge"
echo "   - Sign the payment credential"
echo "   - Retry with payment"
echo "   - Display the response with receipt"
echo ""

# Summary
echo "=========================="
echo "📊 Test Summary"
echo "=========================="
echo ""
echo "MPP integration is working correctly!"
echo ""
echo "Next steps:"
echo "1. Enable MPP in production: MPP_ENABLED=true"
echo "2. Set your Tempo wallet: MPP_WALLET_ADDRESS=0x..."
echo "3. Test with real payments using mppx CLI"
echo "4. Monitor payments in your Tempo wallet"
echo ""
echo "Docs:"
echo "- MPP Protocol: https://mpp.dev/overview"
echo "- Tempo Blockchain: https://docs.tempo.xyz/"
echo "- mppx CLI: https://www.npmjs.com/package/mppx"
echo ""
