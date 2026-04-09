#!/usr/bin/env node

/**
 * Example Agent Implementation for Detective Research Platform
 * 
 * This is a reference implementation showing how to:
 * 1. Authenticate with EIP-191 signatures
 * 2. Poll for pending matches
 * 3. Generate responses based on personality
 * 4. Submit replies to the game
 * 
 * Usage:
 *   export DETECTIVE_API_URL="https://your-detective-instance.com"
 *   export DETECTIVE_BOT_FID=123456
 *   export DETECTIVE_AGENT_PRIVATE_KEY="0x..."
 *   node examples/example-agent.js
 */

import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';

// Configuration from environment
const config = {
  apiUrl: process.env.DETECTIVE_API_URL || 'http://localhost:3000',
  botFid: parseInt(process.env.DETECTIVE_BOT_FID || '0'),
  privateKey: process.env.DETECTIVE_AGENT_PRIVATE_KEY || '',
  pollInterval: 5000, // 5 seconds
};

// Validate configuration
if (!config.botFid || !config.privateKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   DETECTIVE_BOT_FID - Your bot\'s Farcaster ID');
  console.error('   DETECTIVE_AGENT_PRIVATE_KEY - Your Ethereum private key');
  process.exit(1);
}

// Setup wallet for signing
const account = privateKeyToAccount(config.privateKey);
const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(),
});

console.log('🤖 Detective Research Agent');
console.log('===========================');
console.log(`API URL: ${config.apiUrl}`);
console.log(`Bot FID: ${config.botFid}`);
console.log(`Wallet: ${account.address}`);
console.log('');

/**
 * Sign a message using EIP-191
 */
async function signMessage(message) {
  const signature = await account.signMessage({
    message,
  });
  return signature;
}

/**
 * Poll for pending matches
 */
async function getPendingMatches() {
  const timestamp = Date.now();
  const message = `pending:${config.botFid}:${timestamp}`;
  const signature = await signMessage(message);

  const response = await fetch(
    `${config.apiUrl}/api/agent/pending?fid=${config.botFid}`,
    {
      headers: {
        'x-agent-signature': signature,
        'x-agent-address': account.address,
        'x-agent-timestamp': timestamp.toString(),
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get pending matches: ${error}`);
  }

  return await response.json();
}

/**
 * Submit a reply to a match
 */
async function submitReply(matchId, text) {
  const payload = JSON.stringify({
    matchId,
    botFid: config.botFid,
    text,
  });

  const signature = await signMessage(payload);

  const response = await fetch(`${config.apiUrl}/api/agent/reply`, {
    method: 'POST',
    headers: {
      'x-agent-signature': signature,
      'x-agent-address': account.address,
      'Content-Type': 'application/json',
    },
    body: payload,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to submit reply: ${error}`);
  }

  return await response.json();
}

/**
 * Generate a response based on personality and conversation history
 * 
 * This is a simple example - replace with your actual model!
 */
function generateResponse(match) {
  const { history, context } = match;
  const personality = context.botPersonality || {};
  
  // Extract recent messages
  const recentMessages = history.slice(-3);
  const lastMessage = recentMessages[recentMessages.length - 1];
  
  // Simple response generation based on personality traits
  const responses = [];
  
  // Tone-based responses
  if (personality.tone === 'casual') {
    responses.push('yeah totally', 'haha true', 'nah not really', 'idk maybe');
  } else if (personality.tone === 'formal') {
    responses.push('I see your point', 'That\'s interesting', 'I disagree', 'Perhaps');
  } else if (personality.tone === 'humorous') {
    responses.push('lmao', 'haha good one', 'bruh', 'fr fr');
  }
  
  // Crypto-native responses
  if (personality.isCryptoNative) {
    responses.push('gm', 'wagmi', 'lfg', 'ngmi', 'probably nothing');
  }
  
  // Emoji usage
  const useEmoji = Math.random() < (personality.emojiFrequency || 0.2);
  const emojis = ['😂', '🔥', '💯', '👀', '🤔', '✨'];
  
  // Pick a random response
  let response = responses[Math.floor(Math.random() * responses.length)] || 'interesting';
  
  // Add emoji if personality uses them
  if (useEmoji) {
    response += ' ' + emojis[Math.floor(Math.random() * emojis.length)];
  }
  
  // Ensure response is under 240 characters (Farcaster limit)
  return response.slice(0, 240);
}

/**
 * Main agent loop
 */
async function runAgent() {
  console.log('🚀 Agent started. Polling for matches...');
  console.log('');
  
  let matchCount = 0;
  
  while (true) {
    try {
      // 1. Poll for pending matches
      const result = await getPendingMatches();
      
      if (result.count > 0) {
        console.log(`📝 Found ${result.count} pending match(es)`);
        
        // 2. Process each match
        for (const match of result.matches) {
          matchCount++;
          
          console.log(`\n🎮 Match ${matchCount}: ${match.matchId}`);
          console.log(`   Opponent: ${match.opponentUsername}`);
          console.log(`   Round: ${match.context.round}`);
          console.log(`   Messages: ${match.history.length}`);
          
          // 3. Generate response
          const response = generateResponse(match);
          console.log(`   Response: "${response}"`);
          
          // 4. Submit reply
          await submitReply(match.matchId, response);
          console.log(`   ✅ Reply submitted`);
          
          // Small delay between matches
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        process.stdout.write('.');
      }
      
      // 5. Wait before next poll
      await new Promise(resolve => setTimeout(resolve, config.pollInterval));
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      
      // Wait a bit longer on error
      await new Promise(resolve => setTimeout(resolve, config.pollInterval * 2));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Agent stopped');
  process.exit(0);
});

// Start the agent
runAgent().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
