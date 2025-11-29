// src/lib/gamePersistence.ts
/**
 * Game State Persistence Layer
 * 
 * Handles all Redis I/O for game state.
 * Decoupled from game logic - this module only reads/writes.
 */

import { redis, getJSON, setJSON } from "./redis";
import { Player, Bot, Match, PlayerGameSession } from "./types";

const REDIS_KEYS = {
  gameState: "game:state",
  players: "game:players",
  bots: "game:bots",
  matches: "game:matches",
  sessions: "game:sessions",
};

const REDIS_TTL = 60 * 60; // 1 hour

/**
 * Save game cycle metadata to Redis
 */
export async function saveGameStateMeta(state: {
  cycleId: string;
  state: "REGISTRATION" | "LIVE" | "FINISHED";
  registrationEnds: number;
  gameEnds: number;
}): Promise<void> {
  try {
    await setJSON(REDIS_KEYS.gameState, state, REDIS_TTL);
  } catch (error) {
    console.error("[gamePersistence] Failed to save game state meta:", error);
  }
}

/**
 * Load game cycle metadata from Redis
 */
export async function loadGameStateMeta(): Promise<{
  cycleId: string;
  state: "REGISTRATION" | "LIVE" | "FINISHED";
  registrationEnds: number;
  gameEnds: number;
} | null> {
  try {
    return await getJSON(REDIS_KEYS.gameState);
  } catch (error) {
    console.error("[gamePersistence] Failed to load game state meta:", error);
    return null;
  }
}

/**
 * Save a player to Redis
 */
export async function savePlayer(player: Player): Promise<void> {
  try {
    await redis.hset(REDIS_KEYS.players, player.fid.toString(), JSON.stringify(player));
    await redis.expire(REDIS_KEYS.players, REDIS_TTL);
  } catch (error) {
    console.error(`[gamePersistence] Failed to save player ${player.fid}:`, error);
  }
}

/**
 * Load all players from Redis
 */
export async function loadAllPlayers(): Promise<Map<number, Player>> {
  try {
    const playersData = await redis.hgetall(REDIS_KEYS.players);
    const players = new Map<number, Player>();

    if (playersData && Object.keys(playersData).length > 0) {
      for (const [fid, data] of Object.entries(playersData)) {
        try {
          const player = JSON.parse(data) as Player;
          player.voteHistory = player.voteHistory || [];
          players.set(parseInt(fid, 10), player);
        } catch (e) {
          console.error(`[gamePersistence] Failed to parse player ${fid}:`, e);
        }
      }
    }
    return players;
  } catch (error) {
    console.error("[gamePersistence] Failed to load players:", error);
    return new Map();
  }
}

/**
 * Save a bot to Redis
 */
export async function saveBot(bot: Bot): Promise<void> {
  try {
    await redis.hset(REDIS_KEYS.bots, bot.fid.toString(), JSON.stringify(bot));
    await redis.expire(REDIS_KEYS.bots, REDIS_TTL);
  } catch (error) {
    console.error(`[gamePersistence] Failed to save bot ${bot.fid}:`, error);
  }
}

/**
 * Load all bots from Redis
 */
export async function loadAllBots(): Promise<Map<number, Bot>> {
  try {
    const botsData = await redis.hgetall(REDIS_KEYS.bots);
    const bots = new Map<number, Bot>();

    if (botsData && Object.keys(botsData).length > 0) {
      for (const [fid, data] of Object.entries(botsData)) {
        try {
          const bot = JSON.parse(data) as Bot;
          bots.set(parseInt(fid, 10), bot);
        } catch (e) {
          console.error(`[gamePersistence] Failed to parse bot ${fid}:`, e);
        }
      }
    }
    return bots;
  } catch (error) {
    console.error("[gamePersistence] Failed to load bots:", error);
    return new Map();
  }
}

/**
 * Save a match to Redis
 */
export async function saveMatch(match: Match): Promise<void> {
  try {
    await redis.hset(REDIS_KEYS.matches, match.id, JSON.stringify(match));
    await redis.expire(REDIS_KEYS.matches, REDIS_TTL);
  } catch (error) {
    console.error(`[gamePersistence] Failed to save match ${match.id}:`, error);
  }
}

/**
 * Load a match from Redis
 */
export async function loadMatch(matchId: string): Promise<Match | null> {
  try {
    const data = await redis.hget(REDIS_KEYS.matches, matchId);
    if (!data) return null;
    return JSON.parse(data) as Match;
  } catch (error) {
    console.error(`[gamePersistence] Failed to load match ${matchId}:`, error);
    return null;
  }
}

/**
 * Load all matches from Redis
 */
export async function loadAllMatches(): Promise<Map<string, Match>> {
  try {
    const matchesData = await redis.hgetall(REDIS_KEYS.matches);
    const matches = new Map<string, Match>();

    if (matchesData && Object.keys(matchesData).length > 0) {
      for (const [matchId, data] of Object.entries(matchesData)) {
        try {
          const match = JSON.parse(data) as Match;
          matches.set(matchId, match);
        } catch (e) {
          console.error(`[gamePersistence] Failed to parse match ${matchId}:`, e);
        }
      }
    }
    return matches;
  } catch (error) {
    console.error("[gamePersistence] Failed to load matches:", error);
    return new Map();
  }
}

/**
 * Delete a match from Redis
 */
export async function deleteMatch(matchId: string): Promise<void> {
  try {
    await redis.hdel(REDIS_KEYS.matches, matchId);
  } catch (error) {
    console.error(`[gamePersistence] Failed to delete match ${matchId}:`, error);
  }
}

/**
 * Save a session to Redis
 */
export async function saveSession(session: PlayerGameSession): Promise<void> {
  try {
    const serializable = {
      fid: session.fid,
      activeMatches: Array.from(session.activeMatches.entries()),
      completedMatchIds: Array.from(session.completedMatchIds),
      facedOpponents: Array.from(session.facedOpponents.entries()),
      currentRound: session.currentRound,
      nextRoundStartTime: session.nextRoundStartTime,
      completedMatchesPerRound: Array.from(session.completedMatchesPerRound.entries()),
    };
    await redis.hset(REDIS_KEYS.sessions, session.fid.toString(), JSON.stringify(serializable));
    await redis.expire(REDIS_KEYS.sessions, REDIS_TTL);
  } catch (error) {
    console.error(`[gamePersistence] Failed to save session ${session.fid}:`, error);
  }
}

/**
 * Load all sessions from Redis (reset for new game cycle)
 * 
 * NOTE: We intentionally DO NOT restore nextRoundStartTime from previous game.
 * Each new game cycle needs fresh session state. Restoring old timing data
 * causes matches to end prematurely in subsequent games.
 */
export async function loadAllSessions(): Promise<Map<number, PlayerGameSession>> {
  try {
    const sessionsData = await redis.hgetall(REDIS_KEYS.sessions);
    const sessions = new Map<number, PlayerGameSession>();

    if (sessionsData && Object.keys(sessionsData).length > 0) {
      for (const [fid, data] of Object.entries(sessionsData)) {
        try {
          const sessionData = JSON.parse(data);
          const session: PlayerGameSession = {
            fid: sessionData.fid,
            activeMatches: new Map(sessionData.activeMatches || []),
            completedMatchIds: new Set(sessionData.completedMatchIds || []),
            facedOpponents: new Map(sessionData.facedOpponents || []),
            currentRound: 0, // Reset for new game cycle
            nextRoundStartTime: undefined, // RESET - don't carry over timing from previous game
            completedMatchesPerRound: new Map(sessionData.completedMatchesPerRound || []),
          };
          sessions.set(parseInt(fid, 10), session);
        } catch (e) {
          console.error(`[gamePersistence] Failed to parse session ${fid}:`, e);
        }
      }
    }
    return sessions;
  } catch (error) {
    console.error("[gamePersistence] Failed to load sessions:", error);
    return new Map();
  }
}

/**
 * Clear all Redis state (for reset)
 */
export async function clearAll(): Promise<void> {
  try {
    await redis.del(REDIS_KEYS.gameState);
    await redis.del(REDIS_KEYS.players);
    await redis.del(REDIS_KEYS.bots);
    await redis.del(REDIS_KEYS.matches);
    await redis.del(REDIS_KEYS.sessions);
    console.log("[gamePersistence] Cleared all Redis state");
  } catch (error) {
    console.error("[gamePersistence] Failed to clear Redis state:", error);
  }
}
