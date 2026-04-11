#!/usr/bin/env node
/**
 * Generate Stellar Testnet Wallet
 * 
 * This script generates a new Stellar keypair for testnet use.
 * Run: node scripts/generate-stellar-wallet.js
 */

import { execSync } from 'child_process';

// Try to use stellar-sdk if available, otherwise install temporarily
let StellarSdk;
try {
  StellarSdk = await import('stellar-sdk');
} catch (e) {
  console.log('stellar-sdk not found, installing temporarily...');
  execSync('npm install --no-save stellar-sdk', { stdio: 'inherit' });
  StellarSdk = await import('stellar-sdk');
}

// Generate a new random keypair
const keypair = StellarSdk.Keypair.random();

console.log('');
console.log('='.repeat(70));
console.log('STELLAR TESTNET WALLET GENERATED');
console.log('='.repeat(70));
console.log('');
console.log('Public Key (Wallet Address):');
console.log(keypair.publicKey());
console.log('');
console.log('Secret Key (KEEP PRIVATE - DO NOT SHARE):');
console.log(keypair.secret());
console.log('');
console.log('='.repeat(70));
console.log('⚠️  IMPORTANT: Save the secret key securely!');
console.log('='.repeat(70));
console.log('');
console.log('Next steps:');
console.log('');
console.log('1. Fund this wallet with testnet XLM (for transaction fees):');
console.log('   https://laboratory.stellar.org/#account-creator');
console.log('   Paste the public key above and click "Get test network lumens"');
console.log('');
console.log('2. Add USDC trustline (required to receive USDC):');
console.log('   https://laboratory.stellar.org/#txbuilder');
console.log('   - Select "Testnet"');
console.log('   - Source Account: Your public key');
console.log('   - Operation Type: "Change Trust"');
console.log('   - Asset: USDC');
console.log('   - Issuer: Use a testnet USDC issuer');
console.log('');
console.log('3. Get testnet USDC from a faucet or testnet issuer');
console.log('');
console.log('4. Add to .env.local:');
console.log('   STELLAR_MPP_ENABLED=true');
console.log(`   STELLAR_WALLET_ADDRESS=${keypair.publicKey()}`);
console.log('   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org');
console.log('   STELLAR_NETWORK=TESTNET');
console.log('');
console.log('5. (Optional) Save secret key for sending test payments:');
console.log(`   STELLAR_SECRET_KEY=${keypair.secret()}`);
console.log('');
console.log('='.repeat(70));
console.log('');

// Export for programmatic use
export default {
  publicKey: keypair.publicKey(),
  secretKey: keypair.secret()
};
