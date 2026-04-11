// src/lib/performanceCache.ts
/**
 * Centralized performance caching layer
 * Reduces Redis calls and improves response times across all endpoints
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class PerformanceCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 30 seconds
    if (typeof window === "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const perfCache = new PerformanceCache();

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  GAME_STATE: 2000, // 2 seconds - frequently changing
  PLAYER_DATA: 5000, // 5 seconds - changes on registration
  MATCH_DATA: 1000, // 1 second - changes during active game
  LEADERBOARD: 10000, // 10 seconds - less critical
  CONFIG: 30000, // 30 seconds - rarely changes
  ADMIN_STATE: 2000, // 2 seconds - admin dashboard
} as const;

// Helper functions for common cache patterns
export function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = perfCache.get<T>(key);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  return fetcher().then((data) => {
    perfCache.set(key, data, ttl);
    return data;
  });
}

export function invalidateGameState(): void {
  perfCache.invalidatePattern("^game:");
  perfCache.invalidatePattern("^player:");
  perfCache.invalidatePattern("^match:");
}

export function invalidatePlayerData(fid?: number): void {
  if (fid) {
    perfCache.invalidate(`player:${fid}`);
  } else {
    perfCache.invalidatePattern("^player:");
  }
}

export function invalidateMatchData(matchId?: string): void {
  if (matchId) {
    perfCache.invalidate(`match:${matchId}`);
  } else {
    perfCache.invalidatePattern("^match:");
  }
}
