#!/usr/bin/env node
/**
 * Send Stellar Test Payment
 * 
 * This script sends a test USDC payment to Detective's wallet
 * and then makes an API request with the payment proof.
 * 
 * Usage:
 *   node scripts/send-stellar-payment.js [amount] [endpoint]
 * 
 * Example:
 *   node scripts/send-stellar-payment.js 0.10 http://localhost:3000/api/agent/negotiate
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Read .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const STELLAR_WALLET_ADDRESS = envVars.STELLAR_WALLET_ADDRESS;
const STELLAR_SECRET_KEY = envVars.STELLAR_SECRET_KEY;

if (!STELLAR_WALLET_ADDRESS || !STELLAR_SECRET_KEY) {
  console.error('❌ Error: STELLAR_WALLET_ADDRESS and STELLAR_SECRET_KEY must be set in .env.local');
  process.exit(1);
}

// Parse arguments
const amount = process.argv[2] || '0.10';
const endpoint = process.argv[3] || 'http://localhost:3000/api/agent/negotiate';
const agentId = `test-agent-${Date.now()}`;

// Install stellar-sdk if needed
let StellarSdk;
try {
  StellarSdk = await import('stellar-sdk');
} catch (e) {
  console.log('Installing stellar-sdk...');
  execSync('npm install --no-save stellar-sdk', { stdio: 'inherit' });
  StellarSdk = await import('stellar-sdk');
}

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const sourceKeypair = StellarSdk.Keypair.fromSecret(STELLAR_SECRET_KEY);

console.log('');
console.log('='.repeat(70));
console.log('STELLAR PAYMENT TEST');
console.log('='.repeat(70));
console.log('');
console.log('From:', STELLAR_WALLET_ADDRESS);
console.log('To:', STELLAR_WALLET_ADDRESS, '(self-payment for testing)');
console.log('Amount:', amount, 'USDC');
console.log('Endpoint:', endpoint);
console.log('Agent ID:', agentId);
console.log('');

// Step 1: Request endpoint (get 402 challenge)
console.log('Step 1: Requesting endpoint (expecting 402)...');
try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, action: 'start' })
  });
  
  if (response.status === 402) {
    console.log('✅ Received 402 Payment Required');
    const challenge = await response.json();
    console.log('');
    console.log('Challenge:', JSON.stringify(challenge, null, 2));
    console.log('');
  } else {
    console.log(`⚠️  Unexpected status: ${response.status}`);
    const body = await response.text();
    console.log('Response:', body);
    console.log('');
  }
} catch (error) {
  console.error('❌ Error requesting endpoint:', error.message);
  console.log('   Make sure the dev server is running: npm run dev');
  process.exit(1);
}

// Step 2: Send USDC payment
console.log('Step 2: Sending USDC payment...');
console.log('');

try {
  const account = await server.loadAccount(STELLAR_WALLET_ADDRESS);
  
  // Check USDC balance
  const usdcBalance = account.balances.find(b => b.asset_code === 'USDC');
  if (!usdcBalance) {
    console.error('❌ No USDC balance found');
    console.log('   You need to get testnet USDC first');
    console.log('   Try sending from another wallet or using a faucet');
    process.exit(1);
  }
  
  console.log('Current USDC balance:', usdcBalance.balance);
  
  if (parseFloat(usdcBalance.balance) < parseFloat(amount)) {
    console.error(`❌ Insufficient USDC balance (need ${amount}, have ${usdcBalance.balance})`);
    process.exit(1);
  }
  
  // Create USDC asset
  const usdcAsset = new StellarSdk.Asset(
    'USDC',
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  );
  
  // Build payment transaction (self-payment for testing)
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: STELLAR_WALLET_ADDRESS, // Self-payment for testing
        asset: usdcAsset,
        amount: amount
      })
    )
    .setTimeout(30)
    .build();
  
  transaction.sign(sourceKeypair);
  
  const result = await server.submitTransaction(transaction);
  console.log('✅ Payment sent successfully');
  console.log('   Transaction Hash:', result.hash);
  console.log('   View on Explorer:');
  console.log(`   https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  console.log('');
  
  // Step 3: Retry API request with payment proof
  console.log('Step 3: Retrying API request with payment proof...');
  console.log('');
  
  const authHeader = `Payment txHash=${result.hash} amount=${amount} timestamp=${Date.now()} provider=stellar`;
  
  const retryResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({ agentId, action: 'start' })
  });
  
  console.log('Response Status:', retryResponse.status);
  const responseBody = await retryResponse.json();
  console.log('Response Body:', JSON.stringify(responseBody, null, 2));
  console.log('');
  
  if (retryResponse.status === 200) {
    console.log('✅ SUCCESS! Payment verified and match created');
    console.log('   Match ID:', responseBody.matchId);
    console.log('   Payment ID:', responseBody.paymentId);
  } else {
    console.log('⚠️  Payment verification failed');
    console.log('   This might be expected if MPP is not fully enabled');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.response) {
    const errorBody = await error.response.text();
    console.error('   Response:', errorBody);
  }
}

console.log('');
console.log('='.repeat(70));
console.log('TEST COMPLETE');
console.log('='.repeat(70));
console.log('');
