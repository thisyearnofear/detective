// src/lib/adminCache.ts
/**
 * Server-side cache for admin data
 * Reduces Redis REST API calls by caching admin state
 */

import type { AdminStateResponse } from "./types";

let adminDataCache: {
  data: AdminStateResponse;
  timestamp: number;
} | null = null;

const CACHE_TTL = 2000; // 2 seconds

export function getAdminCache(): typeof adminDataCache {
  return adminDataCache;
}

export function setAdminCache(data: AdminStateResponse): void {
  adminDataCache = {
    data,
    timestamp: Date.now(),
  };
}

export function invalidateAdminCache(): void {
  adminDataCache = null;
}

export function isCacheFresh(): boolean {
  if (!adminDataCache) return false;
  return (Date.now() - adminDataCache.timestamp) < CACHE_TTL;
}

export function getCacheTTL(): number {
  return CACHE_TTL;
}
