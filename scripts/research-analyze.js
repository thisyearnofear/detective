#!/usr/bin/env node

/**
 * Analysis Script for Research
 * 
 * Usage:
 *   tsx scripts/research-analyze.ts --metric=dsr --breakdown=personality
 * 
 * Analyzes game data to identify patterns in AI detection.
 */

// Note: Run with tsx (npm install -g tsx) or ts-node
// For now, use the API endpoint: GET /api/admin/analyze

const args = process.argv.slice(2);
const config = {
  metric: args.find(a => a.startsWith('--metric='))?.split('=')[1] || 'dsr',
  breakdown: args.find(a => a.startsWith('--breakdown='))?.split('=')[1] || 'model',
};

console.log('🔬 Detective Research Analysis');
console.log('==============================');
console.log(`Metric: ${config.metric}`);
console.log(`Breakdown: ${config.breakdown}`);
console.log('');

async function analyzeData() {
  try {
    // 1. Overall statistics
    console.log('📊 Overall Statistics');
    console.log('--------------------');
    
    const totalMatches = await db.query(`
      SELECT COUNT(*) as count FROM match_history
    `);
    console.log(`Total Matches: ${totalMatches.rows[0].count}`);

    const humanAccuracy = await db.query(`
      SELECT AVG(accuracy) as avg_accuracy FROM player_stats
    `);
    console.log(`Avg Human Detection Accuracy: ${parseFloat(humanAccuracy.rows[0].avg_accuracy || 0).toFixed(2)}%`);

    const botDSR = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE opponent_type = 'BOT' AND NOT correct) as fooled,
        COUNT(*) FILTER (WHERE opponent_type = 'BOT') as total_bot_matches
      FROM match_history
    `);
    const dsr = botDSR.rows[0].total_bot_matches > 0
      ? (botDSR.rows[0].fooled / botDSR.rows[0].total_bot_matches * 100).toFixed(2)
      : 0;
    console.log(`Overall Bot DSR: ${dsr}%`);
    console.log('');

    // 2. Breakdown analysis
    if (config.breakdown === 'model') {
      console.log('📈 Breakdown by LLM Model');
      console.log('-------------------------');
      
      const modelStats = await db.query(`
        SELECT 
          ps.llm_model_name,
          COUNT(*) as matches,
          AVG(CASE WHEN mh.correct THEN 0 ELSE 100 END) as dsr,
          AVG(mh.speed_ms) as avg_speed
        FROM match_history mh
        JOIN player_stats ps ON mh.opponent_fid = ps.fid
        WHERE mh.opponent_type = 'BOT'
        GROUP BY ps.llm_model_name
        ORDER BY dsr DESC
      `);

      modelStats.rows.forEach(row => {
        console.log(`  ${row.llm_model_name || 'Unknown'}:`);
        console.log(`    - Matches: ${row.matches}`);
        console.log(`    - DSR: ${parseFloat(row.dsr).toFixed(2)}%`);
        console.log(`    - Avg Detection Time: ${(row.avg_speed / 1000).toFixed(1)}s`);
      });
    } else if (config.breakdown === 'personality') {
      console.log('📈 Breakdown by Personality Traits');
      console.log('----------------------------------');
      console.log('(Note: Requires personality data in match_history)');
      // TODO: Implement personality breakdown when data is available
    }

    console.log('');

    // 3. Detection patterns
    console.log('🎯 Detection Patterns');
    console.log('--------------------');
    
    const speedVsAccuracy = await db.query(`
      SELECT 
        CASE 
          WHEN speed_ms < 30000 THEN 'Fast (<30s)'
          WHEN speed_ms < 60000 THEN 'Medium (30-60s)'
          ELSE 'Slow (>60s)'
        END as speed_category,
        COUNT(*) as matches,
        AVG(CASE WHEN correct THEN 100 ELSE 0 END) as accuracy
      FROM match_history
      WHERE opponent_type = 'BOT'
      GROUP BY speed_category
      ORDER BY speed_category
    `);

    console.log('Speed vs Accuracy:');
    speedVsAccuracy.rows.forEach(row => {
      console.log(`  ${row.speed_category}: ${parseFloat(row.accuracy).toFixed(2)}% accuracy (${row.matches} matches)`);
    });

    console.log('');

    // 4. Top performers
    console.log('🏆 Top Performers');
    console.log('-----------------');
    
    const topDetectors = await db.query(`
      SELECT username, accuracy, total_matches
      FROM player_stats
      WHERE total_matches >= 5
      ORDER BY accuracy DESC
      LIMIT 5
    `);

    console.log('Top Human Detectors:');
    topDetectors.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.username}: ${parseFloat(row.accuracy).toFixed(2)}% (${row.total_matches} matches)`);
    });

    console.log('');

    const topBots = await db.query(`
      SELECT username, deception_accuracy as dsr, deception_matches
      FROM player_stats
      WHERE deception_matches >= 5
      ORDER BY deception_accuracy DESC
      LIMIT 5
    `);

    console.log('Top AI Deceivers:');
    topBots.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.username}: ${parseFloat(row.dsr).toFixed(2)}% DSR (${row.deception_matches} matches)`);
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

analyzeData().catch(console.error);
