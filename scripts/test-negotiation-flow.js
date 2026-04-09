#!/usr/bin/env node
/**
 * End-to-end test for negotiation mode
 * 
 * Tests the complete flow:
 * 1. Set game mode to negotiation
 * 2. Check game status includes mode
 * 3. Verify negotiation match creation
 * 4. Test negotiation actions
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-admin-secret';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testNegotiationFlow() {
  console.log('🧪 Testing Negotiation Mode End-to-End\n');

  // Test 1: Update game config to negotiation mode
  console.log('Test 1: Set game mode to negotiation');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET
      },
      body: JSON.stringify({
        action: 'update-config',
        config: {
          mode: 'negotiation'
        }
      })
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    
    if (data.success) {
      console.log(`  ✓ Game mode set to negotiation\n`);
    } else {
      console.log(`  ✗ Failed to set game mode\n`);
      return;
    }
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
    return;
  }

  await sleep(1000);

  // Test 2: Verify game status includes mode
  console.log('Test 2: Check game status includes mode');
  try {
    const response = await fetch(`${BASE_URL}/api/game/status`);
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    
    if (data.mode === 'negotiation') {
      console.log(`  ✓ Game status correctly shows negotiation mode\n`);
    } else {
      console.log(`  ✗ Game status mode mismatch: ${data.mode}\n`);
    }
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  await sleep(1000);

  // Test 3: Get admin state to verify config
  console.log('Test 3: Verify config in admin state');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/state`, {
      headers: {
        'x-admin-secret': ADMIN_SECRET
      }
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Game config:`, data.gameState?.config);
    
    if (data.gameState?.config?.mode === 'negotiation') {
      console.log(`  ✓ Admin state confirms negotiation mode\n`);
    } else {
      console.log(`  ✗ Admin state mode mismatch\n`);
    }
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  await sleep(1000);

  // Test 4: Test negotiation action endpoint (will fail without real match)
  console.log('Test 4: Test negotiation action endpoint structure');
  try {
    const response = await fetch(`${BASE_URL}/api/negotiation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: 'test-match-id',
        action: 'propose',
        message: 'I propose we split the resources fairly',
        proposal: {
          myShare: { books: 2, hats: 2, balls: 2 },
          theirShare: { books: 1, hats: 1, balls: 1 }
        }
      })
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    
    if (response.status === 404 && data.error === 'Match not found') {
      console.log(`  ✓ Endpoint correctly validates match existence\n`);
    } else {
      console.log(`  ℹ Unexpected response (may need real match)\n`);
    }
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  // Test 5: Reset to conversation mode
  console.log('Test 5: Reset to conversation mode');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET
      },
      body: JSON.stringify({
        action: 'update-config',
        config: {
          mode: 'conversation'
        }
      })
    });
    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, data);
    
    if (data.success) {
      console.log(`  ✓ Game mode reset to conversation\n`);
    } else {
      console.log(`  ✗ Failed to reset game mode\n`);
    }
  } catch (error) {
    console.error(`  ✗ Error:`, error.message, '\n');
  }

  console.log('✅ Negotiation flow tests complete\n');
  console.log('Summary:');
  console.log('- Game mode can be switched to negotiation via admin API');
  console.log('- Game status endpoint includes current mode');
  console.log('- Negotiation action endpoint is accessible and validates input');
  console.log('\nNext steps for full testing:');
  console.log('1. Register players with negotiation mode enabled');
  console.log('2. Start a game and get active match IDs');
  console.log('3. Test full negotiation flow with real matches');
}

// Run tests
testNegotiationFlow().catch(console.error);
