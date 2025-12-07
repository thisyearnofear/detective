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

// Check if database is configured
const DATABASE_URL = process.env.DATABASE_URL;
const USE_DATABASE = process.env.USE_DATABASE === "true" && DATABASE_URL;

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

/**
 * In-memory database fallback for development
 */
class InMemoryDatabase {
    private cycles: Map<string, DbGameCycle> = new Map();
    private matches: Map<string, DbMatch> = new Map();
    private playerStats: Map<number, DbPlayerStats> = new Map();
    private gameResults: DbGameResult[] = [];
    private gameResultIdCounter = 1;

    async saveGameCycle(cycle: Omit<DbGameCycle, "created_at">): Promise<void> {
        this.cycles.set(cycle.id, {
            ...cycle,
            created_at: new Date(),
        });
    }

    async getGameCycle(id: string): Promise<DbGameCycle | null> {
        return this.cycles.get(id) || null;
    }

    async saveMatch(match: Omit<DbMatch, "created_at">): Promise<void> {
        this.matches.set(match.id, {
            ...match,
            created_at: new Date(),
        });
    }

    async getMatch(id: string): Promise<DbMatch | null> {
        return this.matches.get(id) || null;
    }

    async getMatchesByPlayer(fid: number, limit: number = 50): Promise<DbMatch[]> {
        return Array.from(this.matches.values())
            .filter(m => m.player_fid === fid)
            .sort((a, b) => b.started_at.getTime() - a.started_at.getTime())
            .slice(0, limit);
    }

    async getMatchesByCycle(cycleId: string): Promise<DbMatch[]> {
        return Array.from(this.matches.values())
            .filter(m => m.cycle_id === cycleId);
    }

    async updatePlayerStats(
        fid: number,
        username: string,
        displayName: string,
        pfpUrl: string,
        matchResult: { correct: boolean; speedMs: number }
    ): Promise<void> {
        const existing = this.playerStats.get(fid);

        if (existing) {
            existing.total_matches++;
            if (matchResult.correct) {
                existing.correct_votes++;
            }
            existing.accuracy = (existing.correct_votes / existing.total_matches) * 100;
            existing.avg_speed_ms = Math.round(
                (existing.avg_speed_ms * (existing.total_matches - 1) + matchResult.speedMs) /
                existing.total_matches
            );
            existing.last_played_at = new Date();
            existing.updated_at = new Date();
        } else {
            this.playerStats.set(fid, {
                fid,
                username,
                display_name: displayName,
                pfp_url: pfpUrl,
                total_games: 1,
                total_matches: 1,
                correct_votes: matchResult.correct ? 1 : 0,
                accuracy: matchResult.correct ? 100 : 0,
                avg_speed_ms: matchResult.speedMs,
                best_streak: matchResult.correct ? 1 : 0,
                last_played_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            });
        }
    }

    async getPlayerStats(fid: number): Promise<DbPlayerStats | null> {
        return this.playerStats.get(fid) || null;
    }

    async getGlobalLeaderboard(limit: number = 100): Promise<DbLeaderboardEntry[]> {
        const stats = Array.from(this.playerStats.values())
            .filter(s => s.total_matches >= 5) // Minimum 5 matches to qualify
            .sort((a, b) => {
                if (b.accuracy !== a.accuracy) {
                    return b.accuracy - a.accuracy;
                }
                return a.avg_speed_ms - b.avg_speed_ms;
            })
            .slice(0, limit);

        return stats.map((s, index) => ({
            fid: s.fid,
            username: s.username,
            display_name: s.display_name,
            pfp_url: s.pfp_url,
            accuracy: s.accuracy,
            avg_speed_ms: s.avg_speed_ms,
            total_matches: s.total_matches,
            total_games: s.total_games,
            total_wins: 0, // In-memory doesn't track wins yet
            rank: index + 1,
        }));
    }

    async incrementPlayerGames(fid: number): Promise<void> {
        const stats = this.playerStats.get(fid);
        if (stats) {
            stats.total_games++;
            stats.updated_at = new Date();
        }
    }

    async saveGameResult(result: Omit<DbGameResult, "id" | "created_at">): Promise<void> {
        this.gameResults.push({
            ...result,
            id: this.gameResultIdCounter++,
            created_at: new Date(),
        });

        // Update total_wins if player won (rank 1)
        if (result.rank === 1) {
            const stats = this.playerStats.get(result.player_fid);
            if (stats) {
                (stats as any).total_wins = ((stats as any).total_wins || 0) + 1;
            }
        }
    }

    async getGameResultsByCycle(cycleId: string): Promise<DbGameResult[]> {
        return this.gameResults
            .filter(r => r.cycle_id === cycleId)
            .sort((a, b) => a.rank - b.rank);
    }

    async getGameResultsByPlayer(fid: number, limit: number = 50): Promise<DbGameResult[]> {
        return this.gameResults
            .filter(r => r.player_fid === fid)
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
            .slice(0, limit);
    }

    async getLeaderboardNearPlayer(fid: number, chain?: string, limit: number = 10): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation doesn't support chain filtering
        console.log(`[InMemoryDB] getLeaderboardNearPlayer called with chain: ${chain || 'all'}`);
        const allEntries = await this.getGlobalLeaderboard(1000); // Get all entries to find the player's position
        const playerIndex = allEntries.findIndex(entry => entry.fid === fid);

        if (playerIndex === -1) {
            // If player not found, return empty array or top entries
            return allEntries.slice(0, limit);
        }

        // Calculate start index to center the player in the results
        const startIndex = Math.max(0, playerIndex - Math.floor(limit / 2));
        const endIndex = Math.min(allEntries.length, startIndex + limit);

        return allEntries.slice(startIndex, endIndex);
    }

    async getTopPlayers(chain?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For in-memory implementation, chain is ignored
        console.log(`[InMemoryDB] getTopPlayers called with chain: ${chain || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getFriendsLeaderboard(fid: number, chain?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // For in-memory implementation, return empty array or global leaderboard
        // Note: fid is used for API compatibility but not implemented in in-memory version
        console.log(`[InMemoryDB] getFriendsLeaderboard called for fid: ${fid}, chain: ${chain || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getCurrentGameLeaderboard(chain?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation uses global leaderboard as fallback
        console.log(`[InMemoryDB] getCurrentGameLeaderboard called with chain: ${chain || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getSeasonLeaderboard(chain?: string, timeframe?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation uses global leaderboard as fallback
        console.log(`[InMemoryDB] getSeasonLeaderboard called with chain: ${chain || 'all'}, timeframe: ${timeframe || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getAllTimeLeaderboard(chain?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation uses global leaderboard as fallback
        console.log(`[InMemoryDB] getAllTimeLeaderboard called with chain: ${chain || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getNFTHolderLeaderboard(chain?: string, timeframe?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation uses global leaderboard as fallback
        console.log(`[InMemoryDB] getNFTHolderLeaderboard called with chain: ${chain || 'all'}, timeframe: ${timeframe || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getTokenHolderLeaderboard(chain?: string, timeframe?: string, limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation uses global leaderboard as fallback
        console.log(`[InMemoryDB] getTokenHolderLeaderboard called with chain: ${chain || 'all'}, timeframe: ${timeframe || 'all'}`);
        return await this.getGlobalLeaderboard(limit);
    }

    async getCrossChainLeaderboard(limit: number = 100): Promise<DbLeaderboardEntry[]> {
        // In-memory implementation uses global leaderboard as fallback
        console.log('[InMemoryDB] getCrossChainLeaderboard called');
        return await this.getGlobalLeaderboard(limit);
    }
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
                connectionTimeoutMillis: 2000,
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
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS player_stats (
        fid INTEGER PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        pfp_url TEXT,
        total_games INTEGER DEFAULT 0,
        total_matches INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        correct_votes INTEGER DEFAULT 0,
        accuracy DECIMAL(5,2) DEFAULT 0,
        avg_speed_ms INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
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
      
      CREATE INDEX IF NOT EXISTS idx_matches_player ON matches(player_fid);
      CREATE INDEX IF NOT EXISTS idx_matches_cycle ON matches(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_player_stats_accuracy ON player_stats(accuracy DESC);
      CREATE INDEX IF NOT EXISTS idx_game_results_cycle ON game_results(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_game_results_player ON game_results(player_fid);
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
        vote_speed_ms, messages, started_at, ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        vote = EXCLUDED.vote,
        is_correct = EXCLUDED.is_correct,
        vote_changes = EXCLUDED.vote_changes,
        vote_speed_ms = EXCLUDED.vote_speed_ms,
        messages = EXCLUDED.messages`,
            [
                match.id, match.cycle_id, match.player_fid, match.opponent_fid,
                match.opponent_type, match.slot_number, match.round_number,
                match.vote, match.is_correct, match.vote_changes, match.vote_speed_ms,
                JSON.stringify(match.messages), match.started_at, match.ended_at
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
        matchResult: { correct: boolean; speedMs: number }
    ): Promise<void> {
        const pool = await this.getPool();

        await pool.query(
            `INSERT INTO player_stats (
        fid, username, display_name, pfp_url, total_matches, correct_votes,
        accuracy, avg_speed_ms, last_played_at, updated_at
      ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (fid) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        pfp_url = EXCLUDED.pfp_url,
        total_matches = player_stats.total_matches + 1,
        correct_votes = player_stats.correct_votes + $5,
        accuracy = ((player_stats.correct_votes + $5)::DECIMAL / (player_stats.total_matches + 1)) * 100,
        avg_speed_ms = ((player_stats.avg_speed_ms * player_stats.total_matches) + $7) / (player_stats.total_matches + 1),
        last_played_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
            [
                fid, username, displayName, pfpUrl,
                matchResult.correct ? 1 : 0,
                matchResult.correct ? 100 : 0,
                matchResult.speedMs
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
        matchResult: { correct: boolean; speedMs: number }
    ): Promise<void>;
    getPlayerStats(fid: number): Promise<DbPlayerStats | null>;
    getGlobalLeaderboard(limit?: number): Promise<DbLeaderboardEntry[]>;
    incrementPlayerGames(fid: number): Promise<void>;
    saveGameResult(result: Omit<DbGameResult, "id" | "created_at">): Promise<void>;
    getGameResultsByCycle(cycleId: string): Promise<DbGameResult[]>;
    getGameResultsByPlayer(fid: number, limit?: number): Promise<DbGameResult[]>;
    getLeaderboardNearPlayer(fid: number, chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getTopPlayers(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getFriendsLeaderboard(fid: number, chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getCurrentGameLeaderboard(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getSeasonLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getAllTimeLeaderboard(chain?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getNFTHolderLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getTokenHolderLeaderboard(chain?: string, timeframe?: string, limit?: number): Promise<DbLeaderboardEntry[]>;
    getCrossChainLeaderboard(limit?: number): Promise<DbLeaderboardEntry[]>;
}

// Create database instance
let dbInstance: IDatabase;

if (USE_DATABASE) {
    console.log("[Database] Using PostgreSQL for persistence");
    dbInstance = new PostgresDatabase();
    // Initialize tables
    (dbInstance as PostgresDatabase).initialize().catch(err => {
        console.error("[Database] Failed to initialize:", err);
    });
} else {
    console.log("[Database] Using in-memory storage (no persistence)");
    dbInstance = new InMemoryDatabase();
}

export const database: IDatabase = dbInstance;
export default database;