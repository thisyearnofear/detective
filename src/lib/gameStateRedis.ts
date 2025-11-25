// src/lib/gameStateRedis.ts
/**
 * Redis-backed Game State Manager
 * 
 * This replaces the in-memory singleton with a distributed state manager
 * that can scale horizontally across multiple server instances.
 */

import { redis, RedisKeys, getJSON, setJSON, hgetJSON, hsetJSON, acquireLock, releaseLock } from "./redis";
import {
    GameCycleState,
    Player,
    Bot,
    Match,
    LeaderboardEntry,
    UserProfile,
    PlayerGameSession,
    VoteRecord,
    ChatMessage,
    GameConfig,
} from "./types";

// Game configuration constants
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes
const REGISTRATION_DURATION = 1 * 60 * 1000; // 1 minute
const MAX_PLAYERS = 50;
const MATCH_DURATION = 60 * 1000; // 1 minute per match
const SIMULTANEOUS_MATCHES = 2; // 2 concurrent chats
const INACTIVITY_WARNING = 30 * 1000; // 30 seconds
const INACTIVITY_FORFEIT = 45 * 1000; // 45 seconds
const MAX_ROUNDS = Math.floor(GAME_DURATION / MATCH_DURATION / SIMULTANEOUS_MATCHES);

// TTL for Redis keys (in seconds)
const CYCLE_TTL = 60 * 60; // 1 hour
const MATCH_TTL = 10 * 60; // 10 minutes
const SESSION_TTL = 60 * 60; // 1 hour

/**
 * Redis-backed Game Manager
 * All state is stored in Redis for horizontal scaling
 */
export class RedisGameManager {
    private config: GameConfig = {
        gameDurationMs: GAME_DURATION,
        matchDurationMs: MATCH_DURATION,
        simultaneousMatches: SIMULTANEOUS_MATCHES,
        inactivityWarningMs: INACTIVITY_WARNING,
        inactivityForfeitMs: INACTIVITY_FORFEIT,
        maxInactivityStrikes: 3,
    };

    /**
     * Get or create the current game cycle
     */
    async getCurrentCycle(): Promise<{
        cycleId: string;
        state: GameCycleState;
        registrationEnds: number;
        gameEnds: number;
    }> {
        const currentCycleId = await redis.get(RedisKeys.currentCycle());

        if (currentCycleId) {
            const cycle = await getJSON<{
                cycleId: string;
                state: GameCycleState;
                registrationEnds: number;
                gameEnds: number;
            }>(RedisKeys.gameCycle(currentCycleId));

            if (cycle) {
                // Check for state transitions
                const updatedCycle = await this.updateCycleState(cycle);
                return updatedCycle;
            }
        }

        // Create new cycle
        return this.createNewCycle();
    }

    /**
     * Create a new game cycle
     */
    private async createNewCycle(): Promise<{
        cycleId: string;
        state: GameCycleState;
        registrationEnds: number;
        gameEnds: number;
    }> {
        const now = Date.now();
        const cycleId = `cycle-${now}`;

        const cycle = {
            cycleId,
            state: "REGISTRATION" as GameCycleState,
            registrationEnds: now + REGISTRATION_DURATION,
            gameEnds: now + GAME_DURATION,
        };

        await setJSON(RedisKeys.gameCycle(cycleId), cycle, CYCLE_TTL);
        await redis.set(RedisKeys.currentCycle(), cycleId, { ex: CYCLE_TTL });

        console.log(`[GameManager] Created new cycle: ${cycleId}`);
        return cycle;
    }

    /**
     * Update cycle state based on time
     */
    private async updateCycleState(cycle: {
        cycleId: string;
        state: GameCycleState;
        registrationEnds: number;
        gameEnds: number;
    }): Promise<{
        cycleId: string;
        state: GameCycleState;
        registrationEnds: number;
        gameEnds: number;
    }> {
        const now = Date.now();
        let updated = false;

        if (cycle.state === "REGISTRATION" && now > cycle.registrationEnds) {
            // Check if we have enough players
            const playerCount = await redis.scard(RedisKeys.allPlayers(cycle.cycleId));
            const botCount = await redis.scard(RedisKeys.allBots(cycle.cycleId));
            const totalOpponents = playerCount - 1 + botCount - 1;

            if (totalOpponents < 1) {
                // Extend registration
                console.log(`[GameManager] Not enough players (${totalOpponents}), extending registration`);
                cycle.registrationEnds = now + 30000;
                updated = true;
            } else {
                console.log(`[GameManager] Starting LIVE state with ${totalOpponents} opponents`);
                cycle.state = "LIVE";
                updated = true;
            }
        }

        if (cycle.state === "LIVE" && now > cycle.gameEnds) {
            // Check if all players finished
            const gameDurationExceeded = now > cycle.gameEnds + (2 * 60 * 1000);

            if (gameDurationExceeded) {
                console.log(`[GameManager] Game duration exceeded, finishing`);
                cycle.state = "FINISHED";
                updated = true;
            } else {
                // Extend game time
                cycle.gameEnds = now + (60 * 1000);
                updated = true;
            }
        }

        if (updated) {
            await setJSON(RedisKeys.gameCycle(cycle.cycleId), cycle, CYCLE_TTL);
        }

        return cycle;
    }

    /**
     * Get full game state (for API responses)
     */
    async getGameState(): Promise<{
        cycleId: string;
        state: GameCycleState;
        registrationEnds: number;
        gameEnds: number;
        playerCount: number;
        config: GameConfig;
    }> {
        const cycle = await this.getCurrentCycle();
        const playerCount = await redis.scard(RedisKeys.allPlayers(cycle.cycleId));

        return {
            ...cycle,
            playerCount,
            config: this.config,
        };
    }

    /**
     * Register a new player
     */
    async registerPlayer(
        userProfile: UserProfile,
        recentCasts: { text: string }[],
        style: string
    ): Promise<Player | null> {
        const cycle = await this.getCurrentCycle();

        if (cycle.state !== "REGISTRATION") {
            console.warn(`[GameManager] Cannot register during ${cycle.state} state`);
            return null;
        }

        const playerCount = await redis.scard(RedisKeys.allPlayers(cycle.cycleId));
        if (playerCount >= MAX_PLAYERS) {
            console.warn(`[GameManager] Max players (${MAX_PLAYERS}) reached`);
            return null;
        }

        // Check if already registered
        const existingPlayer = await this.getPlayer(userProfile.fid);
        if (existingPlayer) {
            return existingPlayer;
        }

        // Create player
        const player: Player = {
            ...userProfile,
            type: "REAL",
            isRegistered: true,
            score: 0,
            voteHistory: [],
            inactivityStrikes: 0,
            lastActiveTime: Date.now(),
        };

        // Create bot clone
        const bot: Bot = {
            ...userProfile,
            type: "BOT",
            originalAuthor: userProfile,
            recentCasts,
            style,
        };

        // Store in Redis
        await hsetJSON(RedisKeys.player(userProfile.fid), "data", player);
        await hsetJSON(RedisKeys.bot(userProfile.fid), "data", bot);

        // Add to cycle's player/bot sets
        await redis.sadd(RedisKeys.allPlayers(cycle.cycleId), userProfile.fid.toString());
        await redis.sadd(RedisKeys.allBots(cycle.cycleId), userProfile.fid.toString());

        // Set expiry
        await redis.expire(RedisKeys.player(userProfile.fid), CYCLE_TTL);
        await redis.expire(RedisKeys.bot(userProfile.fid), CYCLE_TTL);

        console.log(`[GameManager] Registered player ${userProfile.fid} (${userProfile.username})`);
        return player;
    }

    /**
     * Get a player by FID
     */
    async getPlayer(fid: number): Promise<Player | null> {
        return hgetJSON<Player>(RedisKeys.player(fid), "data");
    }

    /**
     * Get a bot by FID
     */
    async getBot(fid: number): Promise<Bot | null> {
        return hgetJSON<Bot>(RedisKeys.bot(fid), "data");
    }

    /**
     * Check if a player is registered for the current cycle
     */
    async isPlayerRegistered(fid: number): Promise<boolean> {
        const cycle = await this.getCurrentCycle();
        const isMember = await redis.sismember(RedisKeys.allPlayers(cycle.cycleId), fid.toString());
        return isMember === 1;
    }

    /**
     * Get all players for the current cycle
     */
    async getAllPlayers(): Promise<Player[]> {
        const cycle = await this.getCurrentCycle();
        const fids = await redis.smembers(RedisKeys.allPlayers(cycle.cycleId));

        const players: Player[] = [];
        for (const fid of fids) {
            const player = await this.getPlayer(parseInt(fid, 10));
            if (player) players.push(player);
        }

        return players;
    }

    /**
     * Get all bots for the current cycle
     */
    async getAllBots(): Promise<Bot[]> {
        const cycle = await this.getCurrentCycle();
        const fids = await redis.smembers(RedisKeys.allBots(cycle.cycleId));

        const bots: Bot[] = [];
        for (const fid of fids) {
            const bot = await this.getBot(parseInt(fid, 10));
            if (bot) bots.push(bot);
        }

        return bots;
    }

    /**
     * Get or create player session
     */
    async getOrCreateSession(fid: number): Promise<PlayerGameSession> {
        const cycle = await this.getCurrentCycle();
        const sessionKey = RedisKeys.playerSession(fid, cycle.cycleId);

        // Define serialized session type
        type SerializedSession = {
            fid: number;
            activeMatches: [number, string][];
            completedMatchIds: string[];
            facedOpponents: [number, number][];
            currentRound: number;
            nextRoundStartTime?: number;
        };

        const session = await getJSON<SerializedSession>(sessionKey);

        if (!session) {
            const newSession: SerializedSession = {
                fid,
                activeMatches: [],
                completedMatchIds: [],
                facedOpponents: [],
                currentRound: 0,
                nextRoundStartTime: undefined,
            };
            await setJSON(sessionKey, newSession, SESSION_TTL);

            // Return as PlayerGameSession with Maps/Sets
            return {
                fid,
                activeMatches: new Map(),
                completedMatchIds: new Set(),
                facedOpponents: new Map(),
                currentRound: 0,
                nextRoundStartTime: undefined,
            };
        }

        // Convert arrays back to Maps/Sets for compatibility
        return {
            fid: session.fid,
            activeMatches: new Map(session.activeMatches),
            completedMatchIds: new Set(session.completedMatchIds),
            facedOpponents: new Map(session.facedOpponents),
            currentRound: session.currentRound,
            nextRoundStartTime: session.nextRoundStartTime,
        };
    }

    /**
     * Save player session
     */
    async saveSession(session: PlayerGameSession): Promise<void> {
        const cycle = await this.getCurrentCycle();
        const sessionKey = RedisKeys.playerSession(session.fid, cycle.cycleId);

        // Convert Maps/Sets to arrays for JSON storage
        const serializable = {
            fid: session.fid,
            activeMatches: Array.from(session.activeMatches.entries()),
            completedMatchIds: Array.from(session.completedMatchIds),
            facedOpponents: Array.from(session.facedOpponents.entries()),
            currentRound: session.currentRound,
            nextRoundStartTime: session.nextRoundStartTime,
        };

        await setJSON(sessionKey, serializable, SESSION_TTL);
    }

    /**
     * Get active matches for a player
     */
    async getActiveMatches(fid: number): Promise<Match[]> {
        const cycle = await this.getCurrentCycle();

        if (cycle.state !== "LIVE") {
            console.log(`[GameManager] Game not LIVE, state: ${cycle.state}`);
            return [];
        }

        const player = await this.getPlayer(fid);
        if (!player) {
            console.log(`[GameManager] Player ${fid} not found`);
            return [];
        }

        const session = await this.getOrCreateSession(fid);
        const now = Date.now();
        const matches: Match[] = [];

        // Calculate max rounds
        const players = await this.getAllPlayers();
        const bots = await this.getAllBots();
        const totalOpponents = players.length - 1 + bots.length - 1;
        const maxPossibleMatches = totalOpponents * this.config.simultaneousMatches;
        const maxRounds = Math.min(
            MAX_ROUNDS,
            Math.ceil(maxPossibleMatches / this.config.simultaneousMatches)
        );

        if (session.currentRound > maxRounds) {
            return [];
        }

        // Check existing matches
        let hasExpiredMatches = false;
        let activeMatchCount = 0;

        for (const [slotNum, matchId] of session.activeMatches) {
            const match = await this.getMatch(matchId);

            if (!match) {
                hasExpiredMatches = true;
                session.activeMatches.delete(slotNum);
            } else if (match.endTime <= now && !match.voteLocked) {
                await this.lockMatchVote(matchId);
                matches.push(match);
                activeMatchCount++;
            } else if (match.endTime <= now && match.voteLocked) {
                matches.push(match);
                activeMatchCount++;
                hasExpiredMatches = true;
            } else {
                matches.push(match);
                activeMatchCount++;
            }
        }

        // Check if it's time for a new round
        const GRACE_PERIOD_MS = 5000;
        const isGracePeriodOver = session.nextRoundStartTime && now >= (session.nextRoundStartTime + GRACE_PERIOD_MS);
        const isRoundComplete = activeMatchCount === 0 && (hasExpiredMatches && isGracePeriodOver || session.activeMatches.size === 0);
        const isTimeForNextRound = session.nextRoundStartTime && now >= (session.nextRoundStartTime + GRACE_PERIOD_MS);

        if (!session.nextRoundStartTime && activeMatchCount === 0) {
            // First round
            console.log(`[GameManager] Starting first round for player ${fid}`);
            session.currentRound = 1;
            session.nextRoundStartTime = now + this.config.matchDurationMs;

            for (let slotNum = 1; slotNum <= this.config.simultaneousMatches; slotNum++) {
                const match = await this.createMatchForSlot(fid, slotNum as 1 | 2, session, players, bots);
                if (match) {
                    session.activeMatches.set(slotNum, match.id);
                    matches.push(match);
                }
            }
        } else if (isRoundComplete && session.currentRound < maxRounds && isTimeForNextRound) {
            // Next round
            console.log(`[GameManager] Starting round ${session.currentRound + 1} for player ${fid}`);
            session.currentRound++;
            session.nextRoundStartTime = now + this.config.matchDurationMs;
            session.activeMatches.clear();

            for (let slotNum = 1; slotNum <= this.config.simultaneousMatches; slotNum++) {
                const match = await this.createMatchForSlot(fid, slotNum as 1 | 2, session, players, bots);
                if (match) {
                    session.activeMatches.set(slotNum, match.id);
                    matches.push(match);
                }
            }
        } else if (isRoundComplete && session.currentRound === maxRounds && isTimeForNextRound) {
            // Game finished for this player
            console.log(`[GameManager] Game finished for player ${fid}`);
            session.currentRound++;
            session.activeMatches.clear();
        }

        // Save session
        await this.saveSession(session);

        return matches;
    }

    /**
     * Create a match for a specific slot
     */
    private async createMatchForSlot(
        fid: number,
        slotNumber: 1 | 2,
        session: PlayerGameSession,
        players: Player[],
        bots: Bot[]
    ): Promise<Match | null> {
        const player = await this.getPlayer(fid);
        if (!player) return null;

        const opponent = this.selectOpponent(fid, session, players, bots);
        if (!opponent) {
            console.error(`[GameManager] No opponent found for player ${fid}`);
            return null;
        }

        const now = Date.now();
        const match: Match = {
            id: `match-${fid}-${opponent.fid}-${now}-s${slotNumber}`,
            player,
            opponent,
            startTime: now,
            endTime: now + this.config.matchDurationMs,
            messages: [],
            isVotingComplete: false,
            isFinished: false,
            slotNumber,
            roundNumber: session.currentRound,
            voteHistory: [],
            voteLocked: false,
            lastPlayerMessageTime: now,
        };

        // Store match
        await setJSON(RedisKeys.match(match.id), match, MATCH_TTL);

        // Track faced opponents
        const facedCount = session.facedOpponents.get(opponent.fid) || 0;
        session.facedOpponents.set(opponent.fid, facedCount + 1);

        console.log(`[GameManager] Created match ${match.id}`);
        return match;
    }

    /**
     * Select an opponent for a player
     */
    private selectOpponent(
        playerFid: number,
        session: PlayerGameSession,
        players: Player[],
        bots: Bot[]
    ): Player | Bot | null {
        const allOpponents = [
            ...players.filter(p => p.fid !== playerFid),
            ...bots.filter(b => b.fid !== playerFid),
        ];

        if (allOpponents.length === 0) return null;

        // Calculate repeat threshold
        const totalOpponents = allOpponents.length;
        const matchesPlayed = session.completedMatchIds.size;
        const allowRepeats = matchesPlayed >= totalOpponents;

        const maxFaceCount = allowRepeats
            ? Math.ceil(matchesPlayed / totalOpponents)
            : 1;

        const availableOpponents = allOpponents.filter(
            o => (session.facedOpponents.get(o.fid) || 0) < maxFaceCount
        );

        const opponentsToChooseFrom = availableOpponents.length > 0 ? availableOpponents : allOpponents;

        // Sort by least faced
        opponentsToChooseFrom.sort((a, b) => {
            const aFaced = session.facedOpponents.get(a.fid) || 0;
            const bFaced = session.facedOpponents.get(b.fid) || 0;
            return aFaced - bFaced;
        });

        // Balance bot ratio
        const realPlayers = opponentsToChooseFrom.filter(o => o.type === "REAL");
        const botOpponents = opponentsToChooseFrom.filter(o => o.type === "BOT");

        const idealBotRatio = Math.min(0.6, Math.max(0.4, botOpponents.length / opponentsToChooseFrom.length));
        const currentBotRatio = this.calculateBotRatio(session);

        if (currentBotRatio < idealBotRatio && botOpponents.length > 0) {
            return botOpponents[0];
        } else if (realPlayers.length > 0) {
            return realPlayers[0];
        }

        return opponentsToChooseFrom[0];
    }

    /**
     * Calculate bot ratio for a session
     */
    private calculateBotRatio(_session: PlayerGameSession): number {
        // This would need match data to calculate properly
        // For now, return 0.5 as default
        return 0.5;
    }

    /**
     * Get a match by ID
     */
    async getMatch(matchId: string): Promise<Match | null> {
        return getJSON<Match>(RedisKeys.match(matchId));
    }

    /**
     * Add a message to a match
     */
    async addMessageToMatch(matchId: string, text: string, senderFid: number): Promise<ChatMessage | null> {
        const match = await this.getMatch(matchId);
        if (!match) return null;

        const sender = await this.getPlayer(senderFid) || await this.getBot(senderFid);
        if (!sender) return null;

        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender: { fid: sender.fid, username: sender.username },
            text,
            timestamp: Date.now(),
        };

        match.messages.push(message);
        match.lastPlayerMessageTime = Date.now();

        await setJSON(RedisKeys.match(matchId), match, MATCH_TTL);

        return message;
    }

    /**
     * Update vote for a match
     */
    async updateMatchVote(matchId: string, vote: "REAL" | "BOT"): Promise<Match | null> {
        const match = await this.getMatch(matchId);
        if (!match || match.voteLocked) return null;

        match.currentVote = vote;
        match.voteHistory.push({
            vote,
            timestamp: Date.now(),
        });

        if (Date.now() >= match.endTime) {
            await this.lockMatchVote(matchId);
        } else {
            await setJSON(RedisKeys.match(matchId), match, MATCH_TTL);
        }

        return match;
    }

    /**
     * Lock vote for a match
     */
    async lockMatchVote(matchId: string): Promise<boolean | null> {
        const lockKey = `match-vote-${matchId}`;
        const acquired = await acquireLock(lockKey, 5);

        if (!acquired) {
            console.warn(`[GameManager] Could not acquire lock for ${matchId}`);
            return null;
        }

        try {
            const match = await this.getMatch(matchId);
            if (!match || match.voteLocked) {
                await releaseLock(lockKey);
                return null;
            }

            match.voteLocked = true;
            match.isVotingComplete = true;
            match.isFinished = true;

            const guess = match.currentVote || "REAL";
            const actualType = match.opponent.type;
            const isCorrect = guess === actualType;

            // Update player vote history
            const player = await this.getPlayer(match.player.fid);
            if (player) {
                const voteRecord: VoteRecord = {
                    matchId,
                    correct: isCorrect,
                    speed: match.currentVote
                        ? match.voteHistory[match.voteHistory.length - 1].timestamp - match.startTime
                        : match.endTime - match.startTime,
                    voteChanges: match.voteHistory.length,
                };

                player.voteHistory.push(voteRecord);
                await hsetJSON(RedisKeys.player(player.fid), "data", player);
            }

            // Update session
            const session = await this.getOrCreateSession(match.player.fid);
            session.completedMatchIds.add(matchId);

            for (const [slot, id] of session.activeMatches) {
                if (id === matchId) {
                    session.activeMatches.delete(slot);
                    break;
                }
            }

            await this.saveSession(session);
            await setJSON(RedisKeys.match(matchId), match, MATCH_TTL);

            console.log(`[GameManager] Locked vote for ${matchId}, correct: ${isCorrect}`);
            return isCorrect;
        } finally {
            await releaseLock(lockKey);
        }
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard(): Promise<LeaderboardEntry[]> {
        const players = await this.getAllPlayers();

        const leaderboard: LeaderboardEntry[] = players.map(player => {
            const correctVotes = player.voteHistory.filter(v => v.correct && !v.forfeit);
            const accuracy = player.voteHistory.length > 0
                ? (correctVotes.length / player.voteHistory.length) * 100
                : 0;
            const avgSpeed = correctVotes.length > 0
                ? correctVotes.reduce((sum, v) => sum + v.speed, 0) / correctVotes.length
                : 0;

            return {
                player: {
                    fid: player.fid,
                    username: player.username,
                    displayName: player.displayName,
                    pfpUrl: player.pfpUrl,
                },
                accuracy,
                avgSpeed,
            };
        });

        // Sort by accuracy (desc), then speed (asc)
        leaderboard.sort((a, b) => {
            if (b.accuracy !== a.accuracy) {
                return b.accuracy - a.accuracy;
            }
            return a.avgSpeed - b.avgSpeed;
        });

        return leaderboard;
    }

    // ========== ADMIN METHODS ==========

    /**
     * Force state transition (admin only)
     */
    async forceStateTransition(newState: GameCycleState): Promise<void> {
        const cycle = await this.getCurrentCycle();
        const now = Date.now();

        cycle.state = newState;

        if (newState === "REGISTRATION") {
            cycle.registrationEnds = now + REGISTRATION_DURATION;
            cycle.gameEnds = now + GAME_DURATION;
        } else if (newState === "LIVE") {
            cycle.registrationEnds = now - 1;
            cycle.gameEnds = now + GAME_DURATION;
        }

        await setJSON(RedisKeys.gameCycle(cycle.cycleId), cycle, CYCLE_TTL);
        console.log(`[GameManager] Forced state transition to ${newState}`);
    }

    /**
     * Reset game (admin only)
     */
    async resetGame(): Promise<void> {
        const cycle = await this.getCurrentCycle();

        // Delete all keys for this cycle
        const playerFids = await redis.smembers(RedisKeys.allPlayers(cycle.cycleId));
        const botFids = await redis.smembers(RedisKeys.allBots(cycle.cycleId));

        for (const fid of playerFids) {
            await redis.del(RedisKeys.player(parseInt(fid, 10)));
            await redis.del(RedisKeys.playerSession(parseInt(fid, 10), cycle.cycleId));
        }

        for (const fid of botFids) {
            await redis.del(RedisKeys.bot(parseInt(fid, 10)));
        }

        await redis.del(RedisKeys.allPlayers(cycle.cycleId));
        await redis.del(RedisKeys.allBots(cycle.cycleId));
        await redis.del(RedisKeys.gameCycle(cycle.cycleId));
        await redis.del(RedisKeys.currentCycle());

        console.log(`[GameManager] Reset game, deleted cycle ${cycle.cycleId}`);
    }

    /**
     * Get all matches (admin only)
     */
    async getAllMatches(): Promise<Match[]> {
        const keys = await redis.keys("match:*");
        const matches: Match[] = [];

        for (const key of keys) {
            if (!key.includes(":messages")) {
                const match = await getJSON<Match>(key);
                if (match) matches.push(match);
            }
        }

        return matches;
    }
}

// Export singleton instance
const globalForGame = global as unknown as { redisGameManager: RedisGameManager };

export const redisGameManager = globalForGame.redisGameManager || new RedisGameManager();

if (process.env.NODE_ENV !== "production") {
    globalForGame.redisGameManager = redisGameManager;
}

export default redisGameManager;