#!/usr/bin/env node
/**
 * Setup Stellar Testnet Wallet
 * 
 * This script:
 * 1. Funds the wallet with testnet XLM (for transaction fees)
 * 2. Adds USDC trustline
 * 3. Verifies the setup
 * 
 * Run: node scripts/setup-stellar-testnet.js
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
  console.error('Run: node scripts/generate-stellar-wallet.js first');
  process.exit(1);
}

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
const keypair = StellarSdk.Keypair.fromSecret(STELLAR_SECRET_KEY);

console.log('');
console.log('='.repeat(70));
console.log('STELLAR TESTNET SETUP');
console.log('='.repeat(70));
console.log('');
console.log('Wallet Address:', STELLAR_WALLET_ADDRESS);
console.log('');

// Step 1: Fund account with testnet XLM
console.log('Step 1: Funding account with testnet XLM...');
try {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(STELLAR_WALLET_ADDRESS)}`
  );
  
  if (response.ok) {
    console.log('✅ Account funded with 10,000 testnet XLM');
  } else {
    const error = await response.text();
    console.log('⚠️  Friendbot response:', error);
    console.log('   (Account may already be funded)');
  }
} catch (error) {
  console.error('❌ Error funding account:', error.message);
  console.log('   Try manually at: https://laboratory.stellar.org/#account-creator');
}

console.log('');

// Step 2: Check account balance
console.log('Step 2: Checking account balance...');
try {
  const account = await server.loadAccount(STELLAR_WALLET_ADDRESS);
  console.log('✅ Account exists on testnet');
  console.log('');
  console.log('Balances:');
  account.balances.forEach(balance => {
    if (balance.asset_type === 'native') {
      console.log(`  - XLM: ${balance.balance}`);
    } else {
      console.log(`  - ${balance.asset_code}: ${balance.balance} (${balance.asset_issuer.slice(0, 8)}...)`);
    }
  });
} catch (error) {
  console.error('❌ Error loading account:', error.message);
  console.log('   Account may not be funded yet');
  process.exit(1);
}

console.log('');

// Step 3: Add USDC trustline
console.log('Step 3: Adding USDC trustline...');
console.log('');
console.log('Note: Using Circle testnet USDC issuer');
console.log('Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
console.log('');

try {
  const account = await server.loadAccount(STELLAR_WALLET_ADDRESS);
  
  // Check if USDC trustline already exists
  const hasUSDC = account.balances.some(
    balance => balance.asset_code === 'USDC'
  );
  
  if (hasUSDC) {
    console.log('✅ USDC trustline already exists');
  } else {
    // Create USDC asset (Circle testnet issuer)
    const usdcAsset = new StellarSdk.Asset(
      'USDC',
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    );
    
    // Build transaction to add trustline
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: usdcAsset,
          limit: '1000000' // Max 1M USDC
        })
      )
      .setTimeout(30)
      .build();
    
    transaction.sign(keypair);
    
    const result = await server.submitTransaction(transaction);
    console.log('✅ USDC trustline added successfully');
    console.log('   Transaction:', result.hash);
  }
} catch (error) {
  console.error('❌ Error adding trustline:', error.message);
  if (error.response) {
    console.error('   Response:', await error.response.text());
  }
}

console.log('');

// Step 4: Final balance check
console.log('Step 4: Final balance check...');
try {
  const account = await server.loadAccount(STELLAR_WALLET_ADDRESS);
  console.log('');
  console.log('Current Balances:');
  account.balances.forEach(balance => {
    if (balance.asset_type === 'native') {
      console.log(`  - XLM: ${balance.balance}`);
    } else {
      console.log(`  - ${balance.asset_code}: ${balance.balance}`);
    }
  });
} catch (error) {
  console.error('❌ Error loading account:', error.message);
}

console.log('');
console.log('='.repeat(70));
console.log('SETUP COMPLETE');
console.log('='.repeat(70));
console.log('');
console.log('Next steps:');
console.log('');
console.log('1. Get testnet USDC:');
console.log('   You can send USDC to this address from another testnet wallet');
console.log('   Or use a testnet USDC faucet if available');
console.log('');
console.log('2. Test the integration:');
console.log('   npm run dev');
console.log('   ./scripts/test-stellar-mpp.sh http://localhost:3000/api/agent/negotiate');
console.log('');
console.log('3. Send a real test payment:');
console.log('   Use scripts/send-stellar-payment.js to test the full flow');
console.log('');
console.log('Wallet Address:', STELLAR_WALLET_ADDRESS);
console.log('');
console.log('View on Stellar Explorer:');
console.log(`https://stellar.expert/explorer/testnet/account/${STELLAR_WALLET_ADDRESS}`);
console.log('');
