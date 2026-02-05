// src/lib/database.ts
/**
 * PostgreSQL Database Layer
 * 
 * Provides persistence for:
 * - Match history
 * - Leaderboards (global, all-time)
 * - Player statistics
 * - Game cycle archives
 * 
 * Uses Prisma-like interface but with raw SQL for simplicity.
 * For production, consider using Prisma, Drizzle, or Kysely.
 */

// Database configuration - PostgreSQL is REQUIRED in production
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    `[Database] FATAL: DATABASE_URL not set. PostgreSQL is required. Set DATABASE_URL in .env`
  );
}

console.log(`[Database] PostgreSQL configured: ${DATABASE_URL.substring(0, 60)}...`);

// Helper to convert PostgreSQL DECIMAL strings to numbers
function convertAccuracy(entry: any): any {
  if (entry && typeof entry.accuracy === 'string') {
    return { ...entry, accuracy: parseFloat(entry.accuracy) };
  }
  return entry;
}

// Types for database records
export interface DbGameCycle {
    id: string;
    chain: string; // 'arbitrum' | 'monad' | 'local'
    state: string;
    started_at: Date;
    ended_at: Date | null;
    player_count: number;
    entry_fee_wei: string | null;
    prize_pool_wei: string | null;
    created_at: Date;
}

export interface DbMatch {
    id: string;
    cycle_id: string;
    player_fid: number;
    opponent_fid: number;
    opponent_type: "REAL" | "BOT";
    slot_number: number;
    round_number: number;
    vote: "REAL" | "BOT" | null;
    is_correct: boolean | null;
    vote_changes: number;
    vote_speed_ms: number | null;
    messages: any[];
    staked_amount: string | null;
    stake_currency: "NATIVE" | "USDC" | null;
    stake_tx_hash: string | null;
    payout_amount: string | null;
    started_at: Date;
    ended_at: Date;
    created_at: Date;
}

export interface DbPlayerStats {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    total_games: number;
    total_matches: number;
    correct_votes: number;
    accuracy: number;
    avg_speed_ms: number;
    best_streak: number;
    last_played_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface DbLeaderboardEntry {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    accuracy: number;
    avg_speed_ms: number;
    total_matches: number;
    total_games: number;
    total_wins: number;
    rank: number;
}

export interface DbGameResult {
    id: number;
    cycle_id: string;
    player_fid: number;
    accuracy: number;
    correct_votes: number;
    total_votes: number;
    avg_speed_ms: number;
    rank: number;
    total_players: number;
    prize_won_wei: string | null;
    created_at: Date;
}

export interface DbRegistration {
    id: string;
    cycle_id: string;
    fid: number;
    wallet_address: string;
    arbitrum_tx_hash: string | null;
    created_at: Date;
}



/**
 * PostgreSQL database client
 * Uses pg library for connection
 */
class PostgresDatabase {
    private pool: any = null;
    private initialized = false;

    private async getPool() {
        if (this.pool) return this.pool;

        try {
            // Dynamic import to avoid build errors when pg is not installed
            const { Pool } = require("pg");
            this.pool = new Pool({
                connectionString: DATABASE_URL,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000, // Increased from 2s to 10s for better reliability
            });

            this.pool.on("error", (err: Error) => {
                console.error("[Database] Pool error:", err);
            });

            return this.pool;
        } catch (err) {
            console.error("[Database] Failed to create pool:", err);
            throw err;
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        const pool = await this.getPool();

        // Create tables if they don't exist
        await pool.query(`
      CREATE TABLE IF NOT EXISTS game_cycles (
        id VARCHAR(255) PRIMARY KEY,
        chain VARCHAR(20) DEFAULT 'local',
        state VARCHAR(20) NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        player_count INTEGER DEFAULT 0,
        entry_fee_wei VARCHAR(78),
        prize_pool_wei VARCHAR(78),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(255) PRIMARY KEY,
        cycle_id VARCHAR(255) REFERENCES game_cycles(id),
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
        staked_amount VARCHAR(78),
        payout_amount VARCHAR(78),
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS player_stats (
        fid INTEGER PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        pfp_url TEXT,
        wallet_address VARCHAR(255),
        total_games INTEGER DEFAULT 0,
        total_matches INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        correct_votes INTEGER DEFAULT 0,
        accuracy DECIMAL(5,2) DEFAULT 0,
        avg_speed_ms INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        deception_matches INTEGER DEFAULT 0,
        deception_successes INTEGER DEFAULT 0,
        deception_accuracy DECIMAL(5,2) DEFAULT 0,
        last_played_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS game_results (
        id SERIAL PRIMARY KEY,
        cycle_id VARCHAR(255) REFERENCES game_cycles(id),
        player_fid INTEGER NOT NULL,
        accuracy DECIMAL(5,2) NOT NULL,
        correct_votes INTEGER NOT NULL,
        total_votes INTEGER NOT NULL,
        avg_speed_ms INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        total_players INTEGER NOT NULL,
        prize_won_wei VARCHAR(78),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS game_registrations (
        id VARCHAR(255) PRIMARY KEY,
        cycle_id VARCHAR(255) NOT NULL REFERENCES game_cycles(id),
        fid INTEGER NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        arbitrum_tx_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(player_fid);
      CREATE INDEX IF NOT EXISTS idx_matches_cycle ON matches(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_player_stats_accuracy ON player_stats(accuracy DESC);
      CREATE INDEX IF NOT EXISTS idx_game_results_cycle ON game_results(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_game_results_player ON game_results(player_fid);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_tx_hash ON game_registrations(cycle_id, arbitrum_tx_hash);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_fid_cycle ON game_registrations(cycle_id, fid);
      CREATE INDEX IF NOT EXISTS idx_game_results_rank ON game_results(rank);
    `);

        // Add columns if they don't exist (for existing databases)
        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'total_wins') THEN
          ALTER TABLE player_stats ADD COLUMN total_wins INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_cycles' AND column_name = 'chain') THEN
          ALTER TABLE game_cycles ADD COLUMN chain VARCHAR(20) DEFAULT 'local';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_cycles' AND column_name = 'entry_fee_wei') THEN
          ALTER TABLE game_cycles ADD COLUMN entry_fee_wei VARCHAR(78);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_cycles' AND column_name = 'prize_pool_wei') THEN
          ALTER TABLE game_cycles ADD COLUMN prize_pool_wei VARCHAR(78);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'deception_matches') THEN
          ALTER TABLE player_stats ADD COLUMN deception_matches INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'deception_successes') THEN
          ALTER TABLE player_stats ADD COLUMN deception_successes INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'deception_accuracy') THEN
          ALTER TABLE player_stats ADD COLUMN deception_accuracy DECIMAL(5,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'stake_currency') THEN
          ALTER TABLE matches ADD COLUMN stake_currency VARCHAR(10);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'stake_tx_hash') THEN
          ALTER TABLE matches ADD COLUMN stake_tx_hash VARCHAR(255);
        END IF;
      END $$;
    `);

        this.initialized = true;
        console.log("[Database] Tables initialized");
    }

    async saveGameCycle(cycle: Omit<DbGameCycle, "created_at">): Promise<void> {
        const pool = await this.getPool();
        await pool.query(
            `INSERT INTO game_cycles (id, state, started_at, ended_at, player_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         state = EXCLUDED.state,
         ended_at = EXCLUDED.ended_at,
         player_count = EXCLUDED.player_count`,
            [cycle.id, cycle.state, cycle.started_at, cycle.ended_at, cycle.player_count]
        );
    }

    async getGameCycle(id: string): Promise<DbGameCycle | null> {
        const pool = await this.getPool();
        const result = await pool.query(
            "SELECT * FROM game_cycles WHERE id = $1",
            [id]
        );
        return result.rows[0] || null;
    }

    async saveMatch(match: Omit<DbMatch, "created_at">): Promise<void> {
        const pool = await this.getPool();
        await pool.query(
            `INSERT INTO matches (
        id, cycle_id, player_fid, opponent_fid, opponent_type,
        slot_number, round_number, vote, is_correct, vote_changes,
        vote_speed_ms, messages, staked_amount, stake_currency, stake_tx_hash,
        payout_amount, started_at, ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        vote = EXCLUDED.vote,
        is_correct = EXCLUDED.is_correct,
        vote_changes = EXCLUDED.vote_changes,
        vote_speed_ms = EXCLUDED.vote_speed_ms,
        messages = EXCLUDED.messages,
        stake_currency = EXCLUDED.stake_currency,
        stake_tx_hash = EXCLUDED.stake_tx_hash,
        payout_amount = EXCLUDED.payout_amount`,
            [
                match.id, match.cycle_id, match.player_fid, match.opponent_fid,
                match.opponent_type, match.slot_number, match.round_number,
                match.vote, match.is_correct, match.vote_changes, match.vote_speed_ms,
                JSON.stringify(match.messages), match.staked_amount, match.stake_currency,
                match.stake_tx_hash, match.payout_amount, match.started_at, match.ended_at
            ]
        );
    }

    async getMatch(id: string): Promise<DbMatch | null> {
        const pool = await this.getPool();
        const result = await pool.query(
            "SELECT * FROM matches WHERE id = $1",
            [id]
        );
        return result.rows[0] || null;
    }

    async getMatchesByPlayer(fid: number, limit: number = 50): Promise<DbMatch[]> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT * FROM matches 
       WHERE player_fid = $1 
       ORDER BY started_at DESC 
       LIMIT $2`,
            [fid, limit]
        );
        return result.rows;
    }

    async getMatchesByCycle(cycleId: string): Promise<DbMatch[]> {
        const pool = await this.getPool();
        const result = await pool.query(
            "SELECT * FROM matches WHERE cycle_id = $1",
            [cycleId]
        );
        return result.rows;
    }

    async updatePlayerStats(
        fid: number,
        username: string,
        displayName: string,
        pfpUrl: string,
        metrics: {
            detection?: { correct: boolean; speedMs: number };
            deception?: { successful: boolean };
        },
        walletAddress?: string
    ): Promise<void> {
        const pool = await this.getPool();

        const d_inc = metrics.detection ? 1 : 0;
        const d_correct = metrics.detection?.correct ? 1 : 0;
        const d_speed = metrics.detection?.speedMs || 0;

        const s_inc = metrics.deception ? 1 : 0;
        const s_success = metrics.deception?.successful ? 1 : 0;

        await pool.query(
            `INSERT INTO player_stats (
        fid, username, display_name, pfp_url, wallet_address, 
        total_matches, correct_votes, accuracy, avg_speed_ms,
        deception_matches, deception_successes, deception_accuracy,
        last_played_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (fid) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        pfp_url = EXCLUDED.pfp_url,
        wallet_address = COALESCE(EXCLUDED.wallet_address, player_stats.wallet_address),
        
        total_matches = player_stats.total_matches + $6,
        correct_votes = player_stats.correct_votes + $7,
        accuracy = CASE 
            WHEN (player_stats.total_matches + $6) > 0 
            THEN ((player_stats.correct_votes + $7)::DECIMAL / (player_stats.total_matches + $6)) * 100 
            ELSE 0 
        END,
        avg_speed_ms = CASE 
            WHEN (player_stats.total_matches + $6) > 0 
            THEN ((player_stats.avg_speed_ms * player_stats.total_matches) + $9) / (player_stats.total_matches + $6)
            ELSE 0 
        END,

        deception_matches = player_stats.deception_matches + $10,
        deception_successes = player_stats.deception_successes + $11,
        deception_accuracy = CASE 
            WHEN (player_stats.deception_matches + $10) > 0 
            THEN ((player_stats.deception_successes + $11)::DECIMAL / (player_stats.deception_matches + $10)) * 100 
            ELSE 0 
        END,

        last_played_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
            [
                fid, username, displayName, pfpUrl, walletAddress?.toLowerCase() || null,
                d_inc, d_correct, (d_inc > 0 ? (d_correct * 100) : 0), d_speed,
                s_inc, s_success, (s_inc > 0 ? (s_success * 100) : 0)
            ]
        );
    }

    async getPlayerStats(fid: number): Promise<DbPlayerStats | null> {
        const pool = await this.getPool();
        const result = await pool.query(
            "SELECT * FROM player_stats WHERE fid = $1",
            [fid]
        );
        return result.rows[0] ? convertAccuracy(result.rows[0]) : null;
    }

    async getGlobalLeaderboard(limit: number = 100): Promise<DbLeaderboardEntry[]> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
        fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
        total_games, COALESCE(total_wins, 0) as total_wins,
        ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
       FROM player_stats
       WHERE total_matches >= 5
       ORDER BY accuracy DESC, avg_speed_ms ASC
       LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    async getAgentLeaderboard(limit: number = 100): Promise<any[]> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
        fid, username, display_name, pfp_url, deception_accuracy as dsr, 
        deception_matches as total_deceptions, deception_successes as total_successes,
        ROW_NUMBER() OVER (ORDER BY deception_accuracy DESC, deception_matches DESC) as rank
       FROM player_stats
       WHERE deception_matches >= 5
       ORDER BY deception_accuracy DESC, deception_matches DESC
       LIMIT $1`,
            [limit]
        );
        return result.rows.map((row: any) => ({
            ...row,
            dsr: parseFloat(row.dsr)
        }));
    }

    async incrementPlayerGames(fid: number): Promise<void> {
        const pool = await this.getPool();
        await pool.query(
            `UPDATE player_stats
       SET total_games = total_games + 1, updated_at = CURRENT_TIMESTAMP
       WHERE fid = $1`,
            [fid]
        );
    }

    async saveGameResult(result: Omit<DbGameResult, "id" | "created_at">): Promise<void> {
        const pool = await this.getPool();
        await pool.query(
            `INSERT INTO game_results (
        cycle_id, player_fid, accuracy, correct_votes, total_votes,
        avg_speed_ms, rank, total_players, prize_won_wei
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                result.cycle_id, result.player_fid, result.accuracy,
                result.correct_votes, result.total_votes, result.avg_speed_ms,
                result.rank, result.total_players, result.prize_won_wei
            ]
        );

        // Update total_wins if player won (rank 1)
        if (result.rank === 1) {
            await pool.query(
                `UPDATE player_stats
         SET total_wins = total_wins + 1, updated_at = CURRENT_TIMESTAMP
         WHERE fid = $1`,
                [result.player_fid]
            );
        }
    }

    async getGameResultsByCycle(cycleId: string): Promise<DbGameResult[]> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT * FROM game_results
       WHERE cycle_id = $1
       ORDER BY rank ASC`,
            [cycleId]
        );
        return result.rows.map(convertAccuracy);
    }

    async getGameResultsByPlayer(fid: number, limit: number = 50): Promise<DbGameResult[]> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT * FROM game_results
       WHERE player_fid = $1
       ORDER BY created_at DESC
       LIMIT $2`,
            [fid, limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getLeaderboardNearPlayer(fid: number, chain: string = 'arbitrum', limit: number = 10): Promise<DbLeaderboardEntry[]> {
        const pool = await this.getPool();

        // Note: The chain parameter is for API compatibility.
        // Currently, player stats are tracked across all chains.
        // In a full implementation, this would filter by chain.
        console.log(`[PostgresDB] getLeaderboardNearPlayer called with chain: ${chain}`);

        // First, get the player's rank
        const rankQuery = `
            SELECT ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5 AND fid = $1
        `;
        const rankResult = await pool.query(rankQuery, [fid]);

        if (rankResult.rows.length === 0) {
            // If player doesn't exist or doesn't qualify, return top players
            return await this.getGlobalLeaderboard(limit);
        }

        const playerRank = rankResult.rows[0].rank;

        // Calculate the range of ranks to fetch
        const startRank = Math.max(1, playerRank - Math.floor(limit / 2));

        // Get players in that rank range
        const result = await pool.query(`
            SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms,
                total_matches, total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            OFFSET $1 LIMIT $2
        `, [startRank - 1, limit]);

        return result.rows.map(convertAccuracy);
    }

    async getTopPlayers(chain: string = 'arbitrum', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        const pool = await this.getPool();

        // Note: The chain parameter is for API compatibility.
        // Currently, player stats are tracked across all chains.
        // In a full implementation, this would filter by chain.
        console.log(`[PostgresDB] getTopPlayers called with chain: ${chain}`);

        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getFriendsLeaderboard(fid: number, chain: string = 'arbitrum', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For now, this is a simplified implementation.
        // In a real implementation, you would have a friends relationship system.
        // For now, we'll return the global leaderboard as fallback.

        // Note: The fid and chain parameters are for API compatibility.
        // Currently, friend relationships don't consider chains.
        console.log(`[PostgresDB] getFriendsLeaderboard called for fid: ${fid}, with chain: ${chain}`);

        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getCurrentGameLeaderboard(chain: string = 'arbitrum', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        const pool = await this.getPool();

        // Note: The chain parameter is for API compatibility.
        // Currently, player stats are tracked across all chains.
        // In a full implementation, this would filter by chain.
        console.log(`[PostgresDB] getCurrentGameLeaderboard called with chain: ${chain}`);

        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getSeasonLeaderboard(chain: string = 'arbitrum', timeframe: string = '7d', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For now, using the global leaderboard as a fallback
        // In a real implementation, this would filter by season/timeframe

        // Note: The chain and timeframe parameters are for API compatibility.
        console.log(`[PostgresDB] getSeasonLeaderboard called with chain: ${chain}, timeframe: ${timeframe}`);

        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getAllTimeLeaderboard(chain: string = 'arbitrum', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        const pool = await this.getPool();

        // Note: The chain parameter is for API compatibility.
        // Currently, player stats are tracked across all chains.
        // In a full implementation, this would filter by chain.
        console.log(`[PostgresDB] getAllTimeLeaderboard called with chain: ${chain}`);

        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getNFTHolderLeaderboard(chain: string = 'arbitrum', timeframe: string = '7d', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For now, using the global leaderboard as a fallback
        // In a real implementation, this would filter for NFT holders

        // Note: The chain and timeframe parameters are for API compatibility.
        console.log(`[PostgresDB] getNFTHolderLeaderboard called with chain: ${chain}, timeframe: ${timeframe}`);

        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getTokenHolderLeaderboard(chain: string = 'monad', timeframe: string = '7d', limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For now, using the global leaderboard as a fallback
        // In a real implementation, this would filter for token holders

        // Note: The chain and timeframe parameters are for API compatibility.
        console.log(`[PostgresDB] getTokenHolderLeaderboard called with chain: ${chain}, timeframe: ${timeframe}`);

        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    async getCrossChainLeaderboard(limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For now, using the global leaderboard as a fallback
        // In a real implementation, this would aggregate results from multiple chains
        console.log('[PostgresDB] getCrossChainLeaderboard called');

        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT
                fid, username, display_name, pfp_url, accuracy, avg_speed_ms, total_matches,
                total_games, COALESCE(total_wins, 0) as total_wins,
                ROW_NUMBER() OVER (ORDER BY accuracy DESC, avg_speed_ms ASC) as rank
            FROM player_stats
            WHERE total_matches >= 5
            ORDER BY accuracy DESC, avg_speed_ms ASC
            LIMIT $1`,
            [limit]
        );
        return result.rows.map(convertAccuracy);
    }

    // ========== REGISTRATION TRACKING ==========

    async saveRegistration(registration: Omit<DbRegistration, "id" | "created_at">): Promise<DbRegistration> {
        const pool = await this.getPool();
        const id = `reg-${registration.cycle_id}-${registration.fid}-${Date.now()}`;
        
        try {
            await pool.query(
                `INSERT INTO game_registrations (id, cycle_id, fid, wallet_address, arbitrum_tx_hash)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, registration.cycle_id, registration.fid, registration.wallet_address, registration.arbitrum_tx_hash]
            );
            return { ...registration, id, created_at: new Date() };
        } catch (error: any) {
            if (error.code === '23505') { // UNIQUE constraint violation
                throw new Error(`Duplicate registration: FID ${registration.fid} already registered for cycle ${registration.cycle_id}`);
            }
            throw error;
        }
    }

    async getRegistrationByTxHash(cycleId: string, txHash: string): Promise<DbRegistration | null> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT id, cycle_id, fid, wallet_address, arbitrum_tx_hash, created_at
             FROM game_registrations
             WHERE cycle_id = $1 AND arbitrum_tx_hash = $2`,
            [cycleId, txHash]
        );
        return result.rows[0] || null;
    }

    async getRegistrationByFid(cycleId: string, fid: number): Promise<DbRegistration | null> {
        const pool = await this.getPool();
        const result = await pool.query(
            `SELECT id, cycle_id, fid, wallet_address, arbitrum_tx_hash, created_at
             FROM game_registrations
             WHERE cycle_id = $1 AND fid = $2`,
            [cycleId, fid]
        );
        return result.rows[0] || null;
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}

// Database interface
export interface IDatabase {
    initialize?(): Promise<void>;
    saveGameCycle(cycle: Omit<DbGameCycle, "created_at">): Promise<void>;
    getGameCycle(id: string): Promise<DbGameCycle | null>;
    saveMatch(match: Omit<DbMatch, "created_at">): Promise<void>;
    getMatch(id: string): Promise<DbMatch | null>;
    getMatchesByPlayer(fid: number, limit?: number): Promise<DbMatch[]>;
    getMatchesByCycle(cycleId: string): Promise<DbMatch[]>;
    updatePlayerStats(
        fid: number,
        username: string,
        displayName: string,
        pfpUrl: string,
        metrics: {
            detection?: { correct: boolean; speedMs: number };
            deception?: { successful: boolean };
        },
        walletAddress?: string
    ): Promise<void>;
    getPlayerStats(fid: number): Promise<DbPlayerStats | null>;
    getGlobalLeaderboard(limit?: number): Promise<DbLeaderboardEntry[]>;
    getAgentLeaderboard(limit?: number): Promise<any[]>;
    incrementPlayerGames(fid: number): Promise<void>;
    saveGameResult(result: Omit<DbGameResult, "id" | "created_at">): Promise<void>;
    getGameResultsByCycle(cycleId: string): Promise<DbGameResult[]>;
    getGameResultsByPlayer(fid: number, limit?: number): Promise<DbGameResult[]>;
    getLeaderboardNearPlayer(fid: number, chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getTopPlayers(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getFriendsLeaderboard(fid: number, chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    saveRegistration(registration: Omit<DbRegistration, "id" | "created_at">): Promise<DbRegistration>;
    getRegistrationByTxHash(cycleId: string, txHash: string): Promise<DbRegistration | null>;
    getRegistrationByFid(cycleId: string, fid: number): Promise<DbRegistration | null>;
    getCurrentGameLeaderboard(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getSeasonLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getAllTimeLeaderboard(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getNFTHolderLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getTokenHolderLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getCrossChainLeaderboard(limit?: number): Promise<DbLeaderboardEntry[]>;
}

// Initialize database (lazy initialization at first use)
let dbInstance: PostgresDatabase | null = null;
let initializationPromise: Promise<void> | null = null;

async function getDbInstance(): Promise<PostgresDatabase> {
    if (!dbInstance) {
        dbInstance = new PostgresDatabase();
        if (!initializationPromise) {
            initializationPromise = dbInstance.initialize().catch(err => {
                console.error("[Database] Failed to initialize PostgreSQL:", err);
                process.exit(1); // Fail fast - database is required
            });
        }
        await initializationPromise;
    }
    return dbInstance;
}

// Create proxy to ensure lazy initialization
class DatabaseProxy implements IDatabase {
    async initialize(): Promise<void> {
        const db = await getDbInstance();
        return db.initialize?.();
    }

    async saveGameCycle(cycle: Omit<DbGameCycle, "created_at">): Promise<void> {
        const db = await getDbInstance();
        return db.saveGameCycle(cycle);
    }

    async getGameCycle(id: string): Promise<DbGameCycle | null> {
        const db = await getDbInstance();
        return db.getGameCycle(id);
    }

    async saveMatch(match: Omit<DbMatch, "created_at">): Promise<void> {
        const db = await getDbInstance();
        return db.saveMatch(match);
    }

    async getMatch(id: string): Promise<DbMatch | null> {
        const db = await getDbInstance();
        return db.getMatch(id);
    }

    async getMatchesByPlayer(fid: number, limit?: number): Promise<DbMatch[]> {
        const db = await getDbInstance();
        return db.getMatchesByPlayer(fid, limit);
    }

    async getMatchesByCycle(cycleId: string): Promise<DbMatch[]> {
        const db = await getDbInstance();
        return db.getMatchesByCycle(cycleId);
    }

    async updatePlayerStats(
        fid: number,
        username: string,
        displayName: string,
        pfpUrl: string,
        metrics: {
            detection?: { correct: boolean; speedMs: number };
            deception?: { successful: boolean };
        },
        walletAddress?: string
    ): Promise<void> {
        const db = await getDbInstance();
        return db.updatePlayerStats(fid, username, displayName, pfpUrl, metrics, walletAddress);
    }

    async getPlayerStats(fid: number): Promise<DbPlayerStats | null> {
        const db = await getDbInstance();
        return db.getPlayerStats(fid);
    }

    async getGlobalLeaderboard(limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getGlobalLeaderboard(limit);
    }

    async getAgentLeaderboard(limit?: number): Promise<any[]> {
        const db = await getDbInstance();
        return db.getAgentLeaderboard(limit);
    }

    async incrementPlayerGames(fid: number): Promise<void> {
        const db = await getDbInstance();
        return db.incrementPlayerGames(fid);
    }

    async saveGameResult(result: Omit<DbGameResult, "id" | "created_at">): Promise<void> {
        const db = await getDbInstance();
        return db.saveGameResult(result);
    }

    async getGameResultsByCycle(cycleId: string): Promise<DbGameResult[]> {
        const db = await getDbInstance();
        return db.getGameResultsByCycle(cycleId);
    }

    async getGameResultsByPlayer(fid: number, limit?: number): Promise<DbGameResult[]> {
        const db = await getDbInstance();
        return db.getGameResultsByPlayer(fid, limit);
    }

    async getLeaderboardNearPlayer(fid: number, chain?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getLeaderboardNearPlayer(fid, chain, limit);
    }

    async getTopPlayers(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getTopPlayers(chain, limit);
    }

    async getFriendsLeaderboard(fid: number, chain?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getFriendsLeaderboard(fid, chain, limit);
    }

    async saveRegistration(registration: Omit<DbRegistration, "id" | "created_at">): Promise<DbRegistration> {
        const db = await getDbInstance();
        return db.saveRegistration(registration);
    }

    async getRegistrationByTxHash(cycleId: string, txHash: string): Promise<DbRegistration | null> {
        const db = await getDbInstance();
        return db.getRegistrationByTxHash(cycleId, txHash);
    }

    async getRegistrationByFid(cycleId: string, fid: number): Promise<DbRegistration | null> {
        const db = await getDbInstance();
        return db.getRegistrationByFid(cycleId, fid);
    }

    async getCurrentGameLeaderboard(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getCurrentGameLeaderboard(chain, limit);
    }

    async getSeasonLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getSeasonLeaderboard(chain, timeframe, limit);
    }

    async getAllTimeLeaderboard(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getAllTimeLeaderboard(chain, limit);
    }

    async getNFTHolderLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getNFTHolderLeaderboard(chain, timeframe, limit);
    }

    async getTokenHolderLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getTokenHolderLeaderboard(chain, timeframe, limit);
    }

    async getCrossChainLeaderboard(limit?: number): Promise<DbLeaderboardEntry[]> {
        const db = await getDbInstance();
        return db.getCrossChainLeaderboard(limit);
    }
}

export const db: IDatabase = new DatabaseProxy();
export const database: IDatabase = new DatabaseProxy(); // Backwards compatibility
export default db;