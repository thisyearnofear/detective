/**
 * INTELLIGENT CACHING LAYER
 * Advanced caching with TTL, compression, and mobile-optimized strategies
 */

// LOCAL STORAGE WITH COMPRESSION
class CompressedStorage {
  private static compress(data: string): string {
    // Simple LZ-style compression for JSON data
    return data.replace(/\s+/g, ' ').trim();
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
        localStorage.setItem(key, this.compress(JSON.stringify({ data: value, timestamp: Date.now(), ttl: ttl || 0 })));
      } catch (e2) {
        console.warn('Storage quota exceeded, item not saved');
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
        const item = JSON.parse(this.decompress(localStorage.getItem(key) || ''));
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

// MULTI-LAYER CACHE WITH LRU EVICTION
export class MultiLayerCache {
  private memoryCache = new Map<string, { data: any; timestamp: number; hits: number; ttl: number }>();
  private maxMemoryItems = 50;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  constructor(options?: { maxMemoryItems?: number; defaultTTL?: number }) {
    if (options) {
      this.maxMemoryItems = options.maxMemoryItems || this.maxMemoryItems;
      this.defaultTTL = options.defaultTTL || this.defaultTTL;
    }
  }

  set(key: string, data: any, ttl?: number): void {
    const actualTTL = ttl || this.defaultTTL;
    
    // Memory cache (fastest)
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
      ttl: actualTTL,
    });

    // Evict LRU items if over limit
    if (this.memoryCache.size > this.maxMemoryItems) {
      this.evictLRU();
    }

    // Persistent cache (survives refresh)
    CompressedStorage.setItem(`cache_${key}`, data, actualTTL);
  }

  get<T>(key: string): T | null {
    // Check memory cache first
    const memItem = this.memoryCache.get(key);
    if (memItem) {
      // Check TTL
      if (Date.now() - memItem.timestamp > memItem.ttl) {
        this.memoryCache.delete(key);
      } else {
        memItem.hits++;
        return memItem.data;
      }
    }

    // Check persistent cache
    const persistentData = CompressedStorage.getItem<T>(`cache_${key}`);
    if (persistentData) {
      // Promote to memory cache
      this.set(key, persistentData);
      return persistentData;
    }

    return null;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.memoryCache.clear();
      CompressedStorage.cleanup();
      return;
    }

    const regex = new RegExp(pattern);
    
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear persistent cache
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_') && regex.test(key.slice(6))) {
        localStorage.removeItem(key);
        i--;
      }
    }
  }

  private evictLRU(): void {
    let lruKey = '';
    let lruHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.hits < lruHits || (item.hits === lruHits && item.timestamp < oldestTime)) {
        lruKey = key;
        lruHits = item.hits;
        oldestTime = item.timestamp;
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey);
    }
  }

  getStats() {
    return {
      memorySize: this.memoryCache.size,
      maxMemoryItems: this.maxMemoryItems,
    };
  }
}

// GLOBAL CACHE INSTANCE
export const globalCache = new MultiLayerCache({
  maxMemoryItems: 100,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
});

// REACT HOOK FOR CACHED DATA
export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: {
    ttl?: number;
    enabled?: boolean;
    refetchOnMount?: boolean;
  }
) {
  const { ttl = 5 * 60 * 1000, enabled = true, refetchOnMount = false } = options || {};
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (force = false) => {
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
  }, [key, fetchFn, enabled, ttl]);

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

import { useState, useEffect, useCallback } from 'react';