#!/usr/bin/env node
/**
 * Database Setup Script
 * 
 * Creates the necessary tables for the Detective game.
 * Run with: npm run db:setup
 * 
 * Requires DATABASE_URL environment variable to be set.
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.log("\nTo set up the database:");
  console.log("1. Create a PostgreSQL database");
  console.log("2. Set DATABASE_URL in your .env file");
  console.log("3. Run: npm run db:setup");
  process.exit(1);
}

async function setupDatabase() {
  let pg;
  try {
    pg = await import("pg");
  } catch (err) {
    console.error("❌ pg package not installed");
    console.log("\nInstall with: npm install pg");
    process.exit(1);
  }

  const { Pool } = pg;
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log("🔄 Connecting to database...");

  try {
    // Test connection
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to database");

    console.log("🔄 Creating tables...");

    // Create tables
    await pool.query(`
      -- Game cycles table
      CREATE TABLE IF NOT EXISTS game_cycles (
        id VARCHAR(255) PRIMARY KEY,
        state VARCHAR(20) NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        player_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Matches table
      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(255) PRIMARY KEY,
        cycle_id VARCHAR(255) REFERENCES game_cycles(id) ON DELETE CASCADE,
        player_fid INTEGER NOT NULL,
        opponent_fid INTEGER NOT NULL,
        opponent_type VARCHAR(10) NOT NULL,
        slot_number INTEGER NOT NULL,
        round_number INTEGER NOT NULL,
        vote VARCHAR(10),
        is_correct BOOLEAN,
        vote_changes INTEGER DEFAULT 0,
        vote_speed_ms INTEGER,
        messages JSONB DEFAULT '[]',
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Player statistics table
      CREATE TABLE IF NOT EXISTS player_stats (
        fid INTEGER PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        pfp_url TEXT,
        total_games INTEGER DEFAULT 0,
        total_matches INTEGER DEFAULT 0,
        correct_votes INTEGER DEFAULT 0,
        accuracy DECIMAL(5,2) DEFAULT 0,
        avg_speed_ms INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        last_played_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(player_fid);
      CREATE INDEX IF NOT EXISTS idx_matches_cycle ON matches(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_accuracy ON player_stats(accuracy DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_updated ON player_stats(updated_at DESC);
    `);

    console.log("✅ Tables created successfully");

    // Show table info
    const tablesResult = await pool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('game_cycles', 'matches', 'player_stats')
    `);

    console.log("\n📊 Database tables:");
    for (const row of tablesResult.rows) {
      console.log(`   - ${row.table_name} (${row.column_count} columns)`);
    }

    console.log("\n✅ Database setup complete!");
    console.log("\nNext steps:");
    console.log("1. Set USE_DATABASE=true in your .env file");
    console.log("2. Restart your application");

  } catch (err) {
    console.error("❌ Database setup failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();