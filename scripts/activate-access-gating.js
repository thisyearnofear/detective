#!/usr/bin/env node

/**
 * Quick activation script for Detective access gating
 * Usage: node scripts/activate-access-gating.js [nft|token|both|off]
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

function updateEnvVar(key, value) {
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;
  
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, newLine);
  } else {
    envContent += `\n${newLine}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Set ${key}=${value}`);
}

function activateGating(mode) {
  console.log(`🔐 Activating Detective access gating in ${mode} mode...\n`);
  
  switch (mode) {
    case 'nft':
      updateEnvVar('NEXT_PUBLIC_ACCESS_GATING_ENABLED', 'true');
      updateEnvVar('NEXT_PUBLIC_ARBITRUM_NFT_ENABLED', 'true');
      updateEnvVar('NEXT_PUBLIC_MONAD_TOKEN_ENABLED', 'false');
      console.log('\n🔷 NFT gating activated!');
      console.log('📝 Don\'t forget to set NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT');
      break;
      
    case 'token':
      updateEnvVar('NEXT_PUBLIC_ACCESS_GATING_ENABLED', 'true');
      updateEnvVar('NEXT_PUBLIC_ARBITRUM_NFT_ENABLED', 'false');
      updateEnvVar('NEXT_PUBLIC_MONAD_TOKEN_ENABLED', 'true');
      console.log('\n🟣 Token gating activated!');
      console.log('📝 Don\'t forget to set NEXT_PUBLIC_MONAD_TOKEN_CONTRACT');
      break;
      
    case 'both':
      updateEnvVar('NEXT_PUBLIC_ACCESS_GATING_ENABLED', 'true');
      updateEnvVar('NEXT_PUBLIC_ARBITRUM_NFT_ENABLED', 'true');
      updateEnvVar('NEXT_PUBLIC_MONAD_TOKEN_ENABLED', 'true');
      console.log('\n🌐 Both NFT and token gating activated!');
      console.log('📝 Don\'t forget to set contract addresses');
      break;
      
    case 'off':
      updateEnvVar('NEXT_PUBLIC_ACCESS_GATING_ENABLED', 'false');
      updateEnvVar('NEXT_PUBLIC_ARBITRUM_NFT_ENABLED', 'false');
      updateEnvVar('NEXT_PUBLIC_MONAD_TOKEN_ENABLED', 'false');
      console.log('\n✅ Access gating disabled - app is open to all users');
      break;
      
    default:
      console.log('❌ Invalid mode. Use: nft, token, both, or off');
      console.log('\nExamples:');
      console.log('  node scripts/activate-access-gating.js nft');
      console.log('  node scripts/activate-access-gating.js token'); 
      console.log('  node scripts/activate-access-gating.js both');
      console.log('  node scripts/activate-access-gating.js off');
      return;
  }
  
  console.log('\n🚀 Restart your development server to apply changes');
  console.log('📖 See .env.local.example for full configuration options');
}

// Parse command line arguments
const mode = process.argv[2];

if (!mode) {
  console.log('🔐 Detective Access Gating Control\n');
  console.log('Usage: node scripts/activate-access-gating.js [mode]');
  console.log('\nModes:');
  console.log('  nft   - Require Arbitrum NFT ownership');
  console.log('  token - Require Monad token balance');
  console.log('  both  - Allow either NFT OR token (OR logic)');
  console.log('  off   - Disable gating (open access)');
  console.log('\nCurrent status:');
  
  // Show current status
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const gatingEnabled = content.match(/NEXT_PUBLIC_ACCESS_GATING_ENABLED=(.+)/)?.[1] === 'true';
    const nftEnabled = content.match(/NEXT_PUBLIC_ARBITRUM_NFT_ENABLED=(.+)/)?.[1] === 'true';
    const tokenEnabled = content.match(/NEXT_PUBLIC_MONAD_TOKEN_ENABLED=(.+)/)?.[1] === 'true';
    
    console.log(`  Gating: ${gatingEnabled ? '🟢 ON' : '🔴 OFF'}`);
    console.log(`  NFT: ${nftEnabled ? '🟢 ON' : '🔴 OFF'}`);
    console.log(`  Token: ${tokenEnabled ? '🟢 ON' : '🔴 OFF'}`);
  } else {
    console.log('  No .env.local file found - gating is OFF');
  }
} else {
  activateGating(mode);
}