/**
 * PERSISTENT CACHING LAYER
 * Client-side local storage with TTL
 */

// LOCAL STORAGE WITH COMPRESSION
class CompressedStorage {
  private static compress(data: string): string {
    // Simple LZ-style compression for JSON data
    return data.replace(/\s+/g, " ").trim();
  }

  private static decompress(data: string): string {
    return data;
  }

  static setItem(key: string, value: any, ttl?: number): void {
    try {
      const item = {
        data: value,
        timestamp: Date.now(),
        ttl: ttl || 0,
      };

      const compressed = this.compress(JSON.stringify(item));
      localStorage.setItem(key, compressed);
    } catch (e) {
      // Storage quota exceeded - clear old entries
      this.cleanup();
      try {
        localStorage.setItem(
          key,
          this.compress(
            JSON.stringify({
              data: value,
              timestamp: Date.now(),
              ttl: ttl || 0,
            })
          )
        );
      } catch (e2) {
        console.warn("Storage quota exceeded, item not saved");
      }
    }
  }

  static getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const decompressed = this.decompress(item);
      const parsed = JSON.parse(decompressed);

      // Check TTL
      if (parsed.ttl > 0 && Date.now() - parsed.timestamp > parsed.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  static cleanup(): void {
    // Remove expired items
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        const item = JSON.parse(this.decompress(localStorage.getItem(key) || ""));
        if (item.ttl > 0 && now - item.timestamp > item.ttl) {
          localStorage.removeItem(key);
          i--; // Adjust index after removal
        }
      } catch (e) {
        // Invalid item, remove it
        localStorage.removeItem(key);
        i--;
      }
    }
  }
}

// SIMPLE PERSISTENT CACHE
export class PersistentCache {
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  constructor(options?: { defaultTTL?: number }) {
    if (options?.defaultTTL) {
      this.defaultTTL = options.defaultTTL;
    }
  }

  set(key: string, data: any, ttl?: number): void {
    const actualTTL = ttl || this.defaultTTL;
    CompressedStorage.setItem(`cache_${key}`, data, actualTTL);
  }

  get<T>(key: string): T | null {
    return CompressedStorage.getItem<T>(`cache_${key}`);
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      CompressedStorage.cleanup();
      return;
    }

    const regex = new RegExp(pattern);

    // Clear persistent cache
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("cache_") && regex.test(key.slice(6))) {
        localStorage.removeItem(key);
        i--;
      }
    }
  }
}

// GLOBAL CACHE INSTANCE
export const globalCache = new PersistentCache({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
});

// REACT HOOK FOR CACHED DATA
import { useState, useEffect, useCallback } from "react";

export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: {
    ttl?: number;
    enabled?: boolean;
    refetchOnMount?: boolean;
  }
) {
  const { ttl = 5 * 60 * 1000, enabled = true, refetchOnMount = false } =
    options || {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(
    async (force = false) => {
      if (!enabled) return;

      // Check cache first (unless forced)
      if (!force) {
        const cached = globalCache.get<T>(key);
        if (cached) {
          setData(cached);
          return cached;
        }
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchFn();
        globalCache.set(key, result, ttl);
        setData(result);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [key, fetchFn, enabled, ttl]
  );

  // Initial load
  useEffect(() => {
    if (enabled) {
      fetchData(refetchOnMount);
    }
  }, [fetchData, enabled, refetchOnMount]);

  const invalidate = useCallback(() => {
    globalCache.invalidate(key);
    setData(null);
  }, [key]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
  };
}
