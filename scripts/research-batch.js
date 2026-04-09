#!/usr/bin/env node

/**
 * Batch Evaluation Script for Research
 * 
 * Usage:
 *   tsx scripts/research-batch.ts --model=your-model --matches=100
 * 
 * This script runs automated batch testing for research purposes.
 */

// Note: Run with tsx (npm install -g tsx) or ts-node
// For now, this is a placeholder - use the API endpoints instead

const args = process.argv.slice(2);
const config = {
  model: args.find(a => a.startsWith('--model='))?.split('=')[1] || 'default',
  matches: parseInt(args.find(a => a.startsWith('--matches='))?.split('=')[1] || '10'),
  botFid: parseInt(args.find(a => a.startsWith('--fid='))?.split('=')[1] || '0'),
};

console.log('🔬 Detective Research Batch Evaluation');
console.log('======================================');
console.log(`Model: ${config.model}`);
console.log(`Target Matches: ${config.matches}`);
console.log(`Bot FID: ${config.botFid || 'Auto-assign'}`);
console.log('');

async function runBatchEvaluation() {
  try {
    // 1. Check if game is in LIVE state
    const state = gameManager.getGameState();
    if (state.state !== 'LIVE') {
      console.error('❌ Game must be in LIVE state for batch evaluation');
      console.log('Current state:', state.state);
      process.exit(1);
    }

    // 2. Get or create bot
    let bot;
    if (config.botFid) {
      bot = state.bots.get(config.botFid);
      if (!bot) {
        console.error(`❌ Bot with FID ${config.botFid} not found`);
        process.exit(1);
      }
    } else {
      // Find first external bot
      bot = Array.from(state.bots.values()).find(b => b.isExternal);
      if (!bot) {
        console.error('❌ No external bots found in game');
        console.log('Tip: Register a bot with isExternal=true first');
        process.exit(1);
      }
    }

    console.log(`✅ Using bot: ${bot.username} (FID: ${bot.fid})`);
    console.log('');

    // 3. Run evaluation loop
    let completedMatches = 0;
    let successfulDeceptions = 0;
    const startTime = Date.now();

    while (completedMatches < config.matches) {
      // Poll for pending matches
      const pending = await gameManager.getPendingExternalBotMatches(bot.fid);
      
      if (pending.length === 0) {
        console.log('⏳ No pending matches, waiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      console.log(`📝 Processing ${pending.length} pending match(es)...`);

      for (const match of pending) {
        // Generate response (placeholder - integrate your model here)
        const response = await generateResponse(match, config.model);
        
        // Submit response
        await gameManager.addMessage(match.id, bot.fid, response);
        
        console.log(`  ✓ Match ${match.id}: Sent response`);
      }

      // Check for completed matches
      const allMatches = Array.from(state.matches.values())
        .filter(m => m.opponent.fid === bot.fid && m.isFinished);
      
      completedMatches = allMatches.length;
      successfulDeceptions = allMatches.filter(m => {
        const vote = m.player.voteHistory.find(v => v.matchId === m.id);
        return vote && !vote.correct; // Human voted "REAL" (fooled)
      }).length;

      const dsr = completedMatches > 0 
        ? (successfulDeceptions / completedMatches * 100).toFixed(1)
        : 0;

      console.log(`📊 Progress: ${completedMatches}/${config.matches} matches | DSR: ${dsr}%`);
      console.log('');

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 4. Final results
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const finalDSR = (successfulDeceptions / completedMatches * 100).toFixed(1);

    console.log('');
    console.log('🎉 Batch Evaluation Complete!');
    console.log('============================');
    console.log(`Total Matches: ${completedMatches}`);
    console.log(`Successful Deceptions: ${successfulDeceptions}`);
    console.log(`Deception Success Rate (DSR): ${finalDSR}%`);
    console.log(`Duration: ${duration} minutes`);
    console.log('');

    // 5. Export results
    const results = {
      model: config.model,
      botFid: bot.fid,
      botUsername: bot.username,
      totalMatches: completedMatches,
      successfulDeceptions,
      dsr: parseFloat(finalDSR),
      duration: parseFloat(duration),
      timestamp: new Date().toISOString(),
      matches: allMatches.map(m => ({
        matchId: m.id,
        opponentUsername: m.player.username,
        messageCount: m.messages.length,
        fooledHuman: !m.player.voteHistory.find(v => v.matchId === m.id)?.correct
      }))
    };

    const fs = await import('fs');
    const outputPath = `research-results-${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`📁 Results saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error during batch evaluation:', error);
    process.exit(1);
  }
}

/**
 * Generate response using your model
 * (Placeholder - integrate your actual model here)
 */
async function generateResponse(match, modelName) {
  const bot = match.opponent;
  const history = match.messages;
  
  // TODO: Replace with your actual model integration
  // For now, return a simple response based on personality
  const personality = bot.personality || {};
  const style = bot.style || '';
  
  // Simple fallback response
  const responses = [
    "interesting point",
    "yeah i see what you mean",
    "haha true",
    "not sure about that tbh",
    "makes sense"
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Run the evaluation
runBatchEvaluation().catch(console.error);
