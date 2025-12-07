// src/lib/redis.ts
/**
 * Redis Client - Unified interface for Upstash REST API and in-memory fallback
 * 
 * Supports:
 * - Upstash Redis REST API (recommended for serverless/Vercel)
 * - In-memory fallback (for development without Redis)
 * 
 * Configuration:
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash REST)
 * - USE_REDIS=true to enable
 */

// Configuration
const UPSTASH_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = process.env.USE_REDIS === "true";
const USE_UPSTASH = USE_REDIS && UPSTASH_REST_URL && UPSTASH_REST_TOKEN;

/**
 * Upstash REST API Client
 * Best for serverless environments (Vercel, Cloudflare Workers)
 */
class UpstashRedisClient {
    private url: string;
    private token: string;

    constructor(url: string, token: string) {
        this.url = url;
        this.token = token;
        console.log("[Redis] Using Upstash REST API");
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

    async set(key: string, value: string, options?: { ex?: number; nx?: boolean }): Promise<string | null> {
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

    async hincrby(key: string, field: string, increment: number): Promise<number> {
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

/**
 * In-memory fallback for development without Redis
 */
class InMemoryStore {
    private store: Map<string, string> = new Map();
    private hashStore: Map<string, Map<string, string>> = new Map();
    private setStore: Map<string, Set<string>> = new Map();
    private expiry: Map<string, number> = new Map();

    constructor() {
        console.log("[Redis] Using in-memory store (development mode)");
    }

    private checkExpiry(key: string): boolean {
        const exp = this.expiry.get(key);
        if (exp && Date.now() > exp) {
            this.store.delete(key);
            this.hashStore.delete(key);
            this.setStore.delete(key);
            this.expiry.delete(key);
            return true;
        }
        return false;
    }

    // String operations
    async get(key: string): Promise<string | null> {
        this.checkExpiry(key);
        const value = this.store.get(key) || null;
        if (key.includes("bot:scheduled")) {
            console.log(`[InMemoryStore] GET ${key}: ${value ? "FOUND" : "NOT FOUND"} (store size: ${this.store.size})`);
        }
        return value;
    }

    async set(key: string, value: string, options?: { ex?: number; nx?: boolean }): Promise<string | null> {
        if (options?.nx && this.store.has(key)) {
            return null;
        }
        this.store.set(key, value);
        if (options?.ex) {
            this.expiry.set(key, Date.now() + options.ex * 1000);
        }
        return "OK";
    }

    async setex(key: string, seconds: number, value: string): Promise<string> {
        this.store.set(key, value);
        this.expiry.set(key, Date.now() + seconds * 1000);
        if (key.includes("bot:scheduled")) {
            console.log(`[InMemoryStore] SETEX ${key}: stored (store size: ${this.store.size}, expires in ${seconds}s)`);
        }
        return "OK";
    }

    async del(...keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
            if (this.store.delete(key) || this.hashStore.delete(key) || this.setStore.delete(key)) {
                count++;
            }
            this.expiry.delete(key);
        }
        return count;
    }

    async exists(...keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
            this.checkExpiry(key);
            if (this.store.has(key) || this.hashStore.has(key) || this.setStore.has(key)) {
                count++;
            }
        }
        return count;
    }

    async expire(key: string, seconds: number): Promise<number> {
        if (this.store.has(key) || this.hashStore.has(key) || this.setStore.has(key)) {
            this.expiry.set(key, Date.now() + seconds * 1000);
            return 1;
        }
        return 0;
    }

    async ttl(key: string): Promise<number> {
        const exp = this.expiry.get(key);
        if (!exp) return -1;
        const remaining = Math.ceil((exp - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    async keys(pattern: string): Promise<string[]> {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        const allKeys = [
            ...this.store.keys(),
            ...this.hashStore.keys(),
            ...this.setStore.keys(),
        ];
        return [...new Set(allKeys)].filter((key) => {
            this.checkExpiry(key);
            return regex.test(key);
        });
    }

    // Hash operations
    async hget(key: string, field: string): Promise<string | null> {
        this.checkExpiry(key);
        return this.hashStore.get(key)?.get(field) || null;
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        if (!this.hashStore.has(key)) {
            this.hashStore.set(key, new Map());
        }
        const hash = this.hashStore.get(key)!;
        const isNew = !hash.has(field);
        hash.set(field, value);
        return isNew ? 1 : 0;
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
        const hash = this.hashStore.get(key);
        if (!hash) return 0;
        let count = 0;
        for (const field of fields) {
            if (hash.delete(field)) count++;
        }
        return count;
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        this.checkExpiry(key);
        const hash = this.hashStore.get(key);
        if (!hash) return {};
        return Object.fromEntries(hash);
    }

    async hkeys(key: string): Promise<string[]> {
        this.checkExpiry(key);
        const hash = this.hashStore.get(key);
        return hash ? [...hash.keys()] : [];
    }

    async hexists(key: string, field: string): Promise<number> {
        this.checkExpiry(key);
        return this.hashStore.get(key)?.has(field) ? 1 : 0;
    }

    async hlen(key: string): Promise<number> {
        this.checkExpiry(key);
        return this.hashStore.get(key)?.size || 0;
    }

    async hincrby(key: string, field: string, increment: number): Promise<number> {
        if (!this.hashStore.has(key)) {
            this.hashStore.set(key, new Map());
        }
        const hash = this.hashStore.get(key)!;
        const current = parseInt(hash.get(field) || "0", 10);
        const newValue = current + increment;
        hash.set(field, newValue.toString());
        return newValue;
    }

    // Set operations
    async sadd(key: string, ...members: string[]): Promise<number> {
        if (!this.setStore.has(key)) {
            this.setStore.set(key, new Set());
        }
        const set = this.setStore.get(key)!;
        let added = 0;
        for (const member of members) {
            if (!set.has(member)) {
                set.add(member);
                added++;
            }
        }
        return added;
    }

    async srem(key: string, ...members: string[]): Promise<number> {
        const set = this.setStore.get(key);
        if (!set) return 0;
        let removed = 0;
        for (const member of members) {
            if (set.delete(member)) removed++;
        }
        return removed;
    }

    async smembers(key: string): Promise<string[]> {
        this.checkExpiry(key);
        const set = this.setStore.get(key);
        return set ? [...set] : [];
    }

    async sismember(key: string, member: string): Promise<number> {
        this.checkExpiry(key);
        return this.setStore.get(key)?.has(member) ? 1 : 0;
    }

    async scard(key: string): Promise<number> {
        this.checkExpiry(key);
        return this.setStore.get(key)?.size || 0;
    }

    async ping(): Promise<string> {
        return "PONG";
    }
}

// Unified Redis client type
type RedisClientType = UpstashRedisClient | InMemoryStore;

// Create the appropriate client (inline initialization below, function kept for reference)
// function createRedisClient(): RedisClientType {
//     if (USE_UPSTASH && UPSTASH_REST_URL && UPSTASH_REST_TOKEN) {
//         return new UpstashRedisClient(UPSTASH_REST_URL, UPSTASH_REST_TOKEN);
//     }
//     return new InMemoryStore();
// }

// Initialize client (server-side only)
// Use globalThis to persist InMemoryStore across Hot Module Replacement (HMR)
let redisClient: RedisClientType;

if (typeof window === "undefined") {
    // Server-side
    if (USE_UPSTASH && UPSTASH_REST_URL && UPSTASH_REST_TOKEN) {
        redisClient = new UpstashRedisClient(UPSTASH_REST_URL, UPSTASH_REST_TOKEN);
    } else {
        // Use globalThis to preserve in-memory store across HMR rebuilds
        const globalAny = globalThis as any;
        if (!globalAny.__REDIS_STORE__) {
            console.log("[Redis] Creating new in-memory store instance");
            globalAny.__REDIS_STORE__ = new InMemoryStore();
        } else {
            console.log("[Redis] Reusing existing in-memory store instance from globalThis");
        }
        redisClient = globalAny.__REDIS_STORE__;
    }
} else {
    // Client-side (shouldn't normally happen, but fallback just in case)
    redisClient = new InMemoryStore();
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
    playerMatches: (fid: number, cycleId: string) => `player:${fid}:matches:${cycleId}`,
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
    const result = await redis.set(lockKey, Date.now().toString(), { ex: ttlSeconds, nx: true });
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

export async function hgetJSON<T>(key: string, field: string): Promise<T | null> {
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