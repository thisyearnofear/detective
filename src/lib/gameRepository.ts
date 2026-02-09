/**
 * Game Repository - Single source of truth for all collection data access
 * 
 * ARCHITECTURE:
 * - TTL-based caching (5 seconds): reduces Redis calls in normal operation
 * - Version-aware invalidation: detects when another instance changed state
 * - Selective invalidation: can clear specific collections without full reload
 * 
 * PRINCIPLE: Always return fresh or recently cached data, never stale
 * - Collections are loaded on demand (lazy)
 * - Cache survives for TTL period OR until version bump
 * - Methods that modify data invalidate relevant caches
 * 
 * CLEAN: Single entry point for all data access, no scattered reload methods
 * DRY: All caching logic in one place (loadWithCache pattern)
 * MODULAR: Independent from GameManager state machine
 */

import * as persistence from "./gamePersistence";
import * as stateConsistency from "./stateConsistency";
import { Player, Bot, Match, PlayerGameSession } from "./types";

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
  versionWhenCached: number;
}

export class GameRepository {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 1000; // 1 second TTL for responsive updates
  private lastKnownVersion = -1;

  /**
   * Load all players, using cache if valid.
   * Cache invalidates on: TTL expiry OR version bump
   */
  async getPlayers(): Promise<Map<number, Player>> {
    return this.loadWithCache<Map<number, Player>>(
      "players",
      async () => {
        const players = await persistence.loadAllPlayers();
        const map = new Map<number, Player>();
        players.forEach(p => map.set(p.fid, p));
        return map;
      }
    );
  }

  /**
   * Load all bots, using cache if valid.
   */
  async getBots(): Promise<Map<number, Bot>> {
    return this.loadWithCache<Map<number, Bot>>(
      "bots",
      async () => {
        const bots = await persistence.loadAllBots();
        const map = new Map<number, Bot>();
        bots.forEach(b => map.set(b.fid, b));
        return map;
      }
    );
  }

  /**
   * Load all matches, using cache if valid.
   */
  async getMatches(): Promise<Map<string, Match>> {
    return this.loadWithCache<Map<string, Match>>(
      "matches",
      async () => {
        const matches = await persistence.loadAllMatches();
        const map = new Map<string, Match>();
        matches.forEach(m => map.set(m.id, m));
        return map;
      }
    );
  }

  /**
   * Load all sessions, using cache if valid.
   */
  async getSessions(): Promise<Map<number, PlayerGameSession>> {
    return this.loadWithCache<Map<number, PlayerGameSession>>(
      "sessions",
      async () => {
        const sessions = await persistence.loadAllSessions();
        const map = new Map<number, PlayerGameSession>();
        sessions.forEach(s => map.set(s.fid, s));
        return map;
      }
    );
  }

  /**
   * Core caching logic: load with TTL + version-aware invalidation
   * 
   * Returns cached data if:
   * 1. Cache exists AND
   * 2. Within TTL AND
   * 3. Version hasn't changed
   * 
   * Otherwise loads fresh and caches
   */
  private async loadWithCache<T>(
    key: string,
    loader: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();
    const currentVersion = await stateConsistency.loadStateVersion();

    // Check if cache is still valid
    if (cached) {
      const withinTTL = now - cached.loadedAt < this.CACHE_TTL_MS;
      const versionUnchanged = cached.versionWhenCached === currentVersion;

      if (withinTTL && versionUnchanged) {
        // Cache is valid, use it
        return cached.data;
      }
    }

    // Cache invalid or missing, load fresh
    console.log(
      `[GameRepository] Cache miss/expired for "${key}" (version: ${this.lastKnownVersion} → ${currentVersion})`
    );

    const data = await loader();
    this.cache.set(key, {
      data,
      loadedAt: now,
      versionWhenCached: currentVersion,
    });
    this.lastKnownVersion = currentVersion;

    return data;
  }

  /**
   * Invalidate a specific collection cache
   * Used after mutations: registerPlayer, setPlayerReady, etc
   */
  invalidateCache(key: string): void {
    if (this.cache.has(key)) {
      console.log(`[GameRepository] Invalidated cache: ${key}`);
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate all caches
   * Called on version bump (phase transition detected)
   */
  invalidateAll(): void {
    console.log(`[GameRepository] Invalidated all caches`);
    this.cache.clear();
  }

  /**
   * Clear cache and reset version tracking
   * Called on hard reset or new game cycle
   */
  reset(): void {
    this.cache.clear();
    this.lastKnownVersion = -1;
  }
}

// Singleton instance
let instance: GameRepository | null = null;

export function getRepository(): GameRepository {
  if (!instance) {
    instance = new GameRepository();
  }
  return instance;
}
