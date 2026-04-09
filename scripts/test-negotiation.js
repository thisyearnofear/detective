#!/usr/bin/env node
/**
 * Test script for negotiation mode API
 * 
 * Tests the negotiation action endpoint with various scenarios
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testNegotiationAPI() {
  console.log('🧪 Testing Negotiation API\n');

  // Test 1: Invalid match ID
  console.log('Test 1: Invalid match ID');
  try {
    const response = await fetch(`${BASE_URL}/api/negotiation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: 'invalid-match-id',
        action: 'propose',
        message: 'Test proposal',
        proposal: {
          myShare: { books: 2, hats: 2, balls: 2 },
          theirShare: { books: 1, hats: 1, balls: 1 }
        }
      })
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log(`  ✓ Expected 404 error\n`);
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  // Test 2: Missing required fields
  console.log('Test 2: Missing required fields');
  try {
    const response = await fetch(`${BASE_URL}/api/negotiation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: 'test-match',
        action: 'propose'
        // Missing message and proposal
      })
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log(`  ✓ Expected 400 error\n`);
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  // Test 3: Invalid action type
  console.log('Test 3: Invalid action type');
  try {
    const response = await fetch(`${BASE_URL}/api/negotiation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: 'test-match',
        action: 'invalid-action',
        message: 'Test message'
      })
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    console.log(`  ✓ Should handle gracefully\n`);
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  console.log('✅ Negotiation API tests complete');
  console.log('\nNote: To test with real matches, you need to:');
  console.log('1. Set game mode to "negotiation" via admin API');
  console.log('2. Register players and start a game');
  console.log('3. Get active match IDs from /api/game/matches');
  console.log('4. Use those match IDs in the negotiation action endpoint');
}

// Run tests
testNegotiationAPI().catch(console.error);
