// src/lib/gameManagerUnified.ts
/**
 * Unified Game Manager
 * 
 * Provides a single interface that can use either:
 * - In-memory storage (development, single server)
 * - Redis storage (production, horizontal scaling)
 * 
 * The backend is selected based on environment variables.
 */

import { gameManager as inMemoryGameManager } from "./gameState";
import { redisGameManager } from "./gameStateRedis";
import {
    GameCycleState,
    Player,
    Bot,
    Match,
    LeaderboardEntry,
    UserProfile,
    ChatMessage,
    GameConfig,
} from "./types";

// Check if Redis should be used
const USE_REDIS = process.env.USE_REDIS === "true";

/**
 * Unified interface for game management
 */
export interface IGameManager {
    // State management
    getGameState(): Promise<{
        cycleId: string;
        state: GameCycleState;
        registrationEnds: number;
        gameEnds: number;
        playerCount: number;
        config: GameConfig;
    }>;

    // Player management
    registerPlayer(
        userProfile: UserProfile,
        recentCasts: { text: string }[],
        style: string
    ): Promise<Player | null>;
    getPlayer(fid: number): Promise<Player | null>;
    isPlayerRegistered(fid: number): Promise<boolean>;
    getAllPlayers(): Promise<Player[]>;

    // Bot management
    getBot(fid: number): Promise<Bot | null>;
    getAllBots(): Promise<Bot[]>;

    // Match management
    getActiveMatches(fid: number): Promise<Match[]>;
    getMatch(matchId: string): Promise<Match | null>;
    addMessageToMatch(matchId: string, text: string, senderFid: number): Promise<ChatMessage | null>;
    updateMatchVote(matchId: string, vote: "REAL" | "BOT"): Promise<Match | null>;
    lockMatchVote(matchId: string): Promise<boolean | null>;

    // Leaderboard
    getLeaderboard(): Promise<LeaderboardEntry[]>;

    // Admin
    forceStateTransition(newState: GameCycleState): Promise<void>;
    resetGame(): Promise<void>;
    getAllMatches(): Promise<Match[]>;
}

/**
 * Adapter for the in-memory game manager to match the async interface
 */
class InMemoryGameManagerAdapter implements IGameManager {
    async getGameState() {
        const state = inMemoryGameManager.getGameState();
        return {
            cycleId: state.cycleId,
            state: state.state,
            registrationEnds: state.registrationEnds,
            gameEnds: state.gameEnds,
            playerCount: state.players.size,
            config: state.config,
        };
    }

    async registerPlayer(
        userProfile: UserProfile,
        recentCasts: { text: string }[],
        style: string
    ): Promise<Player | null> {
        return inMemoryGameManager.registerPlayer(userProfile, recentCasts, style);
    }

    async getPlayer(fid: number): Promise<Player | null> {
        const state = inMemoryGameManager.getGameState();
        return state.players.get(fid) || null;
    }

    async isPlayerRegistered(fid: number): Promise<boolean> {
        const state = inMemoryGameManager.getGameState();
        return state.players.has(fid);
    }

    async getAllPlayers(): Promise<Player[]> {
        return inMemoryGameManager.getAllPlayers();
    }

    async getBot(fid: number): Promise<Bot | null> {
        const state = inMemoryGameManager.getGameState();
        return state.bots.get(fid) || null;
    }

    async getAllBots(): Promise<Bot[]> {
        return inMemoryGameManager.getAllBots();
    }

    async getActiveMatches(fid: number): Promise<Match[]> {
        return inMemoryGameManager.getActiveMatches(fid);
    }

    async getMatch(matchId: string): Promise<Match | null> {
        return inMemoryGameManager.getMatch(matchId) || null;
    }

    async addMessageToMatch(matchId: string, text: string, senderFid: number): Promise<ChatMessage | null> {
        return inMemoryGameManager.addMessageToMatch(matchId, text, senderFid);
    }

    async updateMatchVote(matchId: string, vote: "REAL" | "BOT"): Promise<Match | null> {
        return inMemoryGameManager.updateMatchVote(matchId, vote);
    }

    async lockMatchVote(matchId: string): Promise<boolean | null> {
        return inMemoryGameManager.lockMatchVote(matchId);
    }

    async getLeaderboard(): Promise<LeaderboardEntry[]> {
        return inMemoryGameManager.getLeaderboard();
    }

    async forceStateTransition(newState: GameCycleState): Promise<void> {
        inMemoryGameManager.forceStateTransition(newState);
    }

    async resetGame(): Promise<void> {
        inMemoryGameManager.resetGame();
    }

    async getAllMatches(): Promise<Match[]> {
        return inMemoryGameManager.getAllMatches();
    }
}

/**
 * Adapter for the Redis game manager (already async)
 */
class RedisGameManagerAdapter implements IGameManager {
    async getGameState() {
        return redisGameManager.getGameState();
    }

    async registerPlayer(
        userProfile: UserProfile,
        recentCasts: { text: string }[],
        style: string
    ): Promise<Player | null> {
        return redisGameManager.registerPlayer(userProfile, recentCasts, style);
    }

    async getPlayer(fid: number): Promise<Player | null> {
        return redisGameManager.getPlayer(fid);
    }

    async isPlayerRegistered(fid: number): Promise<boolean> {
        return redisGameManager.isPlayerRegistered(fid);
    }

    async getAllPlayers(): Promise<Player[]> {
        return redisGameManager.getAllPlayers();
    }

    async getBot(fid: number): Promise<Bot | null> {
        return redisGameManager.getBot(fid);
    }

    async getAllBots(): Promise<Bot[]> {
        return redisGameManager.getAllBots();
    }

    async getActiveMatches(fid: number): Promise<Match[]> {
        return redisGameManager.getActiveMatches(fid);
    }

    async getMatch(matchId: string): Promise<Match | null> {
        return redisGameManager.getMatch(matchId);
    }

    async addMessageToMatch(matchId: string, text: string, senderFid: number): Promise<ChatMessage | null> {
        return redisGameManager.addMessageToMatch(matchId, text, senderFid);
    }

    async updateMatchVote(matchId: string, vote: "REAL" | "BOT"): Promise<Match | null> {
        return redisGameManager.updateMatchVote(matchId, vote);
    }

    async lockMatchVote(matchId: string): Promise<boolean | null> {
        return redisGameManager.lockMatchVote(matchId);
    }

    async getLeaderboard(): Promise<LeaderboardEntry[]> {
        return redisGameManager.getLeaderboard();
    }

    async forceStateTransition(newState: GameCycleState): Promise<void> {
        return redisGameManager.forceStateTransition(newState);
    }

    async resetGame(): Promise<void> {
        return redisGameManager.resetGame();
    }

    async getAllMatches(): Promise<Match[]> {
        return redisGameManager.getAllMatches();
    }
}

// Create the appropriate manager based on configuration
const createGameManager = (): IGameManager => {
    if (USE_REDIS) {
        console.log("[GameManager] Using Redis backend for horizontal scaling");
        return new RedisGameManagerAdapter();
    } else {
        console.log("[GameManager] Using in-memory backend (single server mode)");
        return new InMemoryGameManagerAdapter();
    }
};

// Export singleton
const globalForGame = global as unknown as { unifiedGameManager: IGameManager };

export const unifiedGameManager: IGameManager =
    globalForGame.unifiedGameManager || createGameManager();

if (process.env.NODE_ENV !== "production") {
    globalForGame.unifiedGameManager = unifiedGameManager;
}

export default unifiedGameManager;