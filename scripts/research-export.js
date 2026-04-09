#!/usr/bin/env node

/**
 * Dataset Export Script for Research
 * 
 * Usage:
 *   tsx scripts/research-export.ts --format=json --filter="cycleId=game-2025-01"
 * 
 * Exports game data for research analysis.
 */

// Note: Run with tsx (npm install -g tsx) or ts-node
// For now, use the API endpoint: GET /api/admin/export

const args = process.argv.slice(2);
const config = {
  format: args.find(a => a.startsWith('--format='))?.split('=')[1] || 'json',
  filter: args.find(a => a.startsWith('--filter='))?.split('=')[1] || '',
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] || `export-${Date.now()}.json`,
};

console.log('📦 Detective Research Data Export');
console.log('=================================');
console.log(`Format: ${config.format}`);
console.log(`Filter: ${config.filter || 'None'}`);
console.log(`Output: ${config.output}`);
console.log('');

async function exportData() {
  try {
    // Parse filter
    const filters = {};
    if (config.filter) {
      config.filter.split(',').forEach(f => {
        const [key, value] = f.split('=');
        filters[key] = value;
      });
    }

    // 1. Export game cycles
    console.log('📊 Exporting game cycles...');
    const cycles = await db.query(`
      SELECT * FROM game_cycles
      ${filters.cycleId ? `WHERE cycle_id = $1` : ''}
      ORDER BY created_at DESC
    `, filters.cycleId ? [filters.cycleId] : []);
    console.log(`  ✓ Found ${cycles.rows.length} game cycle(s)`);

    // 2. Export player stats
    console.log('👥 Exporting player stats...');
    const players = await db.query(`
      SELECT * FROM player_stats
      ORDER BY accuracy DESC
    `);
    console.log(`  ✓ Found ${players.rows.length} player(s)`);

    // 3. Export match history (if available)
    console.log('🎮 Exporting match history...');
    const matches = await db.query(`
      SELECT * FROM match_history
      ${filters.cycleId ? `WHERE cycle_id = $1` : ''}
      ORDER BY created_at DESC
    `, filters.cycleId ? [filters.cycleId] : []);
    console.log(`  ✓ Found ${matches.rows.length} match(es)`);

    // 4. Compile dataset
    const dataset = {
      metadata: {
        exportedAt: new Date().toISOString(),
        filters,
        version: '1.0.0'
      },
      cycles: cycles.rows,
      players: players.rows,
      matches: matches.rows,
      statistics: {
        totalCycles: cycles.rows.length,
        totalPlayers: players.rows.length,
        totalMatches: matches.rows.length,
        avgHumanAccuracy: players.rows.length > 0
          ? (players.rows.reduce((sum, p) => sum + parseFloat(p.accuracy || 0), 0) / players.rows.length).toFixed(2)
          : 0
      }
    };

    // 5. Write to file
    if (config.format === 'json') {
      fs.writeFileSync(config.output, JSON.stringify(dataset, null, 2));
    } else if (config.format === 'csv') {
      // Simple CSV export for matches
      const csv = [
        'match_id,cycle_id,player_fid,opponent_fid,opponent_type,vote,correct,speed_ms',
        ...matches.rows.map(m => 
          `${m.match_id},${m.cycle_id},${m.player_fid},${m.opponent_fid},${m.opponent_type},${m.vote},${m.correct},${m.speed_ms}`
        )
      ].join('\n');
      fs.writeFileSync(config.output, csv);
    }

    console.log('');
    console.log('✅ Export complete!');
    console.log(`📁 Saved to: ${config.output}`);
    console.log('');
    console.log('📈 Dataset Statistics:');
    console.log(`  - Game Cycles: ${dataset.statistics.totalCycles}`);
    console.log(`  - Players: ${dataset.statistics.totalPlayers}`);
    console.log(`  - Matches: ${dataset.statistics.totalMatches}`);
    console.log(`  - Avg Human Accuracy: ${dataset.statistics.avgHumanAccuracy}%`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

exportData().catch(console.error);
