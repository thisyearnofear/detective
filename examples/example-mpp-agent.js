#!/usr/bin/env node

/**
 * Example: MPP-Enabled Agent
 * 
 * Demonstrates how to use Detective's MPP-enabled agent API
 * for paid negotiation matches using Tempo blockchain payments.
 * 
 * Prerequisites:
 * 1. Set up mppx account: npx mppx account create
 * 2. Fund wallet with pathUSD/USDC (Optimization Arena participants have $20 credit)
 * 3. Set environment variables (see below)
 * 
 * Usage:
 *   node examples/example-mpp-agent.js
 */

const DETECTIVE_API_URL = process.env.DETECTIVE_API_URL || 'http://localhost:3000';
const AGENT_ID = process.env.AGENT_ID || 'example-mpp-agent';

console.log('🤖 Detective MPP Agent Example');
console.log('================================\n');

async function main() {
  // Step 1: Get pricing information (free endpoint)
  console.log('📊 Step 1: Fetching MPP pricing...');
  const pricingResponse = await fetch(`${DETECTIVE_API_URL}/api/agent/negotiate`);
  const pricing = await pricingResponse.json();
  
  console.log('Pricing:', JSON.stringify(pricing, null, 2));
  console.log('');

  if (!pricing.enabled) {
    console.log('⚠️  MPP is not enabled on this instance');
    console.log('Set MPP_ENABLED=true in .env.local to enable');
    return;
  }

  // Step 2: Attempt to start a match without payment (will get 402)
  console.log('💳 Step 2: Attempting request without payment...');
  const unpaidResponse = await fetch(`${DETECTIVE_API_URL}/api/agent/negotiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: AGENT_ID,
      action: 'start',
    }),
  });

  console.log(`Status: ${unpaidResponse.status} ${unpaidResponse.statusText}`);
  
  if (unpaidResponse.status === 402) {
    const challenge = await unpaidResponse.json();
    console.log('✅ Received 402 Payment Required challenge:');
    console.log(JSON.stringify(challenge, null, 2));
    console.log('');

    // Step 3: Instructions for making paid request
    console.log('💰 Step 3: Making paid request with mppx CLI');
    console.log('');
    console.log('To complete the payment and make the request, run:');
    console.log('');
    console.log(`  npx mppx ${DETECTIVE_API_URL}/api/agent/negotiate \\`);
    console.log(`    --method POST \\`);
    console.log(`    -J '{"agentId":"${AGENT_ID}","action":"start"}'`);
    console.log('');
    console.log('The mppx CLI will:');
    console.log('1. Receive the 402 challenge');
    console.log('2. Sign a payment credential with your Tempo wallet');
    console.log('3. Retry the request with the payment credential');
    console.log('4. Display the response with a payment receipt');
    console.log('');
    console.log('💡 Optimization Arena participants have $20 Tempo credit!');
    console.log('');
  } else {
    console.log('❌ Unexpected response:', await unpaidResponse.text());
  }

  // Step 4: Example of full agent workflow
  console.log('🔄 Step 4: Full Agent Workflow');
  console.log('');
  console.log('Once payment is set up, your agent receives match details:');
  console.log('');
  console.log('{');
  console.log('  "success": true,');
  console.log('  "matchId": "agent-match-example-mpp-agent-1234567890",');
  console.log('  "agentId": "example-mpp-agent",');
  console.log('  "opponent": {');
  console.log('    "fid": 12345,');
  console.log('    "username": "detective-bot",');
  console.log('    "type": "BOT"');
  console.log('  },');
  console.log('  "resourcePool": { "books": 3, "hats": 2, "balls": 1 },');
  console.log('  "playerValuation": { "books": 4, "hats": 2, "balls": 1 },');
  console.log('  "startTime": 1234567890000,');
  console.log('  "endTime": 1234567890000,');
  console.log('  "paymentId": "mpp-1234567890-0xabcd..."');
  console.log('}');
  console.log('');
  console.log('Then negotiate with proposals:');
  console.log('');
  console.log('// Start match');
  console.log(`const match = await mppxRequest('${DETECTIVE_API_URL}/api/agent/negotiate', {`);
  console.log(`  agentId: '${AGENT_ID}',`);
  console.log(`  action: 'start'`);
  console.log('});');
  console.log('');
  console.log('// Make proposal');
  console.log(`await mppxRequest('${DETECTIVE_API_URL}/api/agent/negotiate', {`);
  console.log(`  agentId: '${AGENT_ID}',`);
  console.log('  action: \'propose\',');
  console.log('  matchId: match.matchId,');
  console.log('  message: \'I propose we split the books evenly\',');
  console.log('  proposal: {');
  console.log('    myShare: { books: 2, hats: 1, balls: 1 },');
  console.log('    theirShare: { books: 1, hats: 1, balls: 0 }');
  console.log('  }');
  console.log('});');
  console.log('');
  console.log('// Accept offer');
  console.log(`await mppxRequest('${DETECTIVE_API_URL}/api/agent/negotiate', {`);
  console.log(`  agentId: '${AGENT_ID}',`);
  console.log('  action: \'accept\',');
  console.log('  matchId: match.matchId,');
  console.log('  message: \'Deal!\'');
  console.log('});');
  console.log('');

  // Step 5: Resources
  console.log('📚 Resources');
  console.log('');
  console.log('- MPP Protocol: https://mpp.dev/overview');
  console.log('- Tempo Blockchain: https://docs.tempo.xyz/');
  console.log('- mppx CLI: https://www.npmjs.com/package/mppx');
  console.log('- Detective API: https://github.com/thisyearnofear/detective');
  console.log('');
}

main().catch(console.error);
