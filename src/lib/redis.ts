// src/lib/redis.ts
/**
 * Redis Client - Upstash REST API
 * 
 * Required for:
 * - State management across requests
 * - Serverless-safe (REST API, no persistent connections)
 * - Distributed locking
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - UPSTASH_REDIS_REST_URL: https://your-instance.upstash.io
 * - UPSTASH_REDIS_REST_TOKEN: your_token
 */

// Configuration - REQUIRED
const UPSTASH_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
  throw new Error(
    `[Redis] FATAL: Missing required environment variables.
    UPSTASH_REDIS_REST_URL: ${UPSTASH_REST_URL ? "✓" : "✗"}
    UPSTASH_REDIS_REST_TOKEN: ${UPSTASH_REST_TOKEN ? "✓" : "✗"}
    
    Redis is required for serverless state management.
    Get free instance at: https://upstash.com`
  );
}

console.log("[Redis] Upstash REST API initialized");

/**
 * Upstash REST API Client
 */
class UpstashRedisClient {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async command<T>(...args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upstash error: ${error}`);
    }

    const data = await response.json();
    if (!data) {
      throw new Error(`Upstash error: Empty response`);
    }
    if (data.error) {
      throw new Error(`Upstash error: ${data.error}`);
    }
    return data.result ?? null;
  }

  // String operations
  async get(key: string): Promise<string | null> {
    return this.command<string | null>("GET", key);
  }

  async set(
    key: string,
    value: string,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null> {
    const args: (string | number)[] = ["SET", key, value];
    if (options?.ex) {
      args.push("EX", options.ex);
    }
    if (options?.nx) {
      args.push("NX");
    }
    return this.command<string | null>(...args);
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.command<string>("SETEX", key, seconds, value);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.command<number>("DEL", ...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.command<number>("EXISTS", ...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.command<number>("EXPIRE", key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.command<number>("TTL", key);
  }

  async incr(key: string): Promise<number> {
    return this.command<number>("INCR", key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.command<string[]>("KEYS", pattern);
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    return this.command<string | null>("HGET", key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.command<number>("HSET", key, field, value);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    return this.command<number>("HDEL", key, ...fields);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const result = await this.command<string[] | null>("HGETALL", key);
    if (!result || result.length === 0) return {};
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1];
    }
    return obj;
  }

  async hkeys(key: string): Promise<string[]> {
    return this.command<string[]>("HKEYS", key);
  }

  async hexists(key: string, field: string): Promise<number> {
    return this.command<number>("HEXISTS", key, field);
  }

  async hlen(key: string): Promise<number> {
    return this.command<number>("HLEN", key);
  }

  async hincrby(
    key: string,
    field: string,
    increment: number
  ): Promise<number> {
    return this.command<number>("HINCRBY", key, field, increment);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.command<number>("SADD", key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.command<number>("SREM", key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.command<string[]>("SMEMBERS", key);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.command<number>("SISMEMBER", key, member);
  }

  async scard(key: string): Promise<number> {
    return this.command<number>("SCARD", key);
  }

  async ping(): Promise<string> {
    return this.command<string>("PING");
  }
}

// Initialize client (server-side only)
let redisClient: UpstashRedisClient;

if (typeof window === "undefined") {
  // Server-side
  redisClient = new UpstashRedisClient(UPSTASH_REST_URL, UPSTASH_REST_TOKEN);
} else {
  // Client-side (should not happen)
  throw new Error("[Redis] Cannot initialize Redis client on client-side");
}

// Export the client
export const redis = redisClient;

// Helper key generators
export const RedisKeys = {
  // Game cycle
  gameCycle: (cycleId: string) => `game:cycle:${cycleId}`,
  currentCycle: () => "game:current_cycle",

  // Players
  player: (fid: number) => `player:${fid}`,
  playerSession: (fid: number, cycleId: string) => `session:${cycleId}:${fid}`,
  allPlayers: (cycleId: string) => `game:${cycleId}:players`,

  // Bots
  bot: (fid: number) => `bot:${fid}`,
  botResponses: (fid: number) => `bot:${fid}:responses`,
  allBots: (cycleId: string) => `game:${cycleId}:bots`,

  // Matches
  match: (matchId: string) => `match:${matchId}`,
  matchMessages: (matchId: string) => `match:${matchId}:messages`,
  playerMatches: (fid: number, cycleId: string) =>
    `player:${fid}:matches:${cycleId}`,
  activeMatches: (fid: number) => `player:${fid}:active_matches`,

  // Leaderboard
  leaderboard: (cycleId: string) => `leaderboard:${cycleId}`,
  globalLeaderboard: () => "leaderboard:global",

  // Locks
  lock: (resource: string) => `lock:${resource}`,
};

// Distributed lock helper
export async function acquireLock(
  resource: string,
  ttlSeconds: number = 10
): Promise<boolean> {
  const lockKey = RedisKeys.lock(resource);
  const result = await redis.set(lockKey, Date.now().toString(), {
    ex: ttlSeconds,
    nx: true,
  });
  return result === "OK";
}

export async function releaseLock(resource: string): Promise<void> {
  await redis.del(RedisKeys.lock(resource));
}

// JSON helpers
export async function getJSON<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setJSON<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const data = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, data);
  } else {
    await redis.set(key, data);
  }
}

export async function hgetJSON<T>(
  key: string,
  field: string
): Promise<T | null> {
  const data = await redis.hget(key, field);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function hsetJSON<T>(
  key: string,
  field: string,
  value: T
): Promise<void> {
  await redis.hset(key, field, JSON.stringify(value));
}

export default redis;
