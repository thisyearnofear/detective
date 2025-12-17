/**
 * State Consistency Manager - Single Source of Truth
 * 
 * Core Principle: DRY + CLEAN
 * All state synchronization logic in one place.
 * Version-based consistency prevents stale caches across serverless instances.
 * 
 * CRITICAL PATTERN - Separate "Collection Changes" from "State Transitions":
 * 
 * PHASE TRANSITIONS (increment version):
 * - REGISTRATION → LIVE (countdown expires)
 * - LIVE → FINISHED (game timer expires)
 * - FINISHED → REGISTRATION (auto-cycle)
 * Use case: Only when game state fundamentally changes
 * Effect: Triggers full reloads on all instances (expensive)
 * 
 * COLLECTION MUTATIONS (do NOT increment version):
 * - Player joins (registerPlayer)
 * - Player ready status changes (setPlayerReady)
 * - Match voting/messages (updateMatchVote, addMessageToMatch)
 * Use case: Frequent changes that don't need sync across instances
 * Effect: Each instance reloads only collections it needs, on demand
 * 
 * How it works:
 * - Redis stores stateVersion (incremented ONLY on phase transitions)
 * - In-memory cache tracks lastLoadedVersion
 * - Before using cached data, validate version matches
 * - If version differs, reload from Redis
 * - Version increments are atomic (SET with NX and compare-and-swap pattern)
 */

import * as persistence from "./gamePersistence";

let stateVersion = 0;
let lastLoadedVersion = -1;
let lastReadVersion = -1; // For detecting version changes

/**
 * Load state version from Redis
 */
export async function loadStateVersion(): Promise<number> {
  try {
    const version = await persistence.loadStateVersion();
    return version || 0;
  } catch (error) {
    console.error("[StateConsistency] Failed to load version:", error);
    return 0;
  }
}

/**
 * Check if in-memory cache is stale
 */
export function isCacheStale(): boolean {
  return lastLoadedVersion !== stateVersion;
}

/**
 * Validate state consistency - reload if needed
 * Returns true if state is fresh, false if stale (reload required)
 */
export async function validateStateConsistency(): Promise<boolean> {
  const redisVersion = await loadStateVersion();
  
  if (redisVersion !== lastLoadedVersion) {
    console.log(`[StateConsistency] Version mismatch: cached=${lastLoadedVersion}, redis=${redisVersion}. Invalidating cache.`);
    lastLoadedVersion = -1; // Invalidate cache
    return false;
  }
  
  return true;
}

/**
 * Mark cache as fresh after loading from Redis
 */
export function markCacheFresh(version: number): void {
  lastLoadedVersion = version;
  stateVersion = version;
  lastReadVersion = version; // Also mark as read to prevent immediate invalidation
  console.log(`[StateConsistency] Cache marked fresh at version ${version}`);
}

/**
 * Attempt atomic state version increment
 * Returns true if successful (this instance did the increment)
 * Returns false if another instance already incremented it
 */
export async function tryIncrementStateVersion(): Promise<boolean> {
  try {
    // Get current version from Redis
    const currentVersion = await loadStateVersion();
    const nextVersion = currentVersion + 1;
    
    // Try to atomically set next version (only if no one else incremented it yet)
    // This prevents concurrent state transitions
    const acquired = await persistence.atomicVersionIncrement(currentVersion, nextVersion);
    
    if (acquired) {
      stateVersion = nextVersion;
      lastLoadedVersion = nextVersion;
      console.log(`[StateConsistency] Incremented version: ${currentVersion} → ${nextVersion}`);
      return true;
    }
    
    // Another instance incremented it, reload fresh state
    const freshVersion = await loadStateVersion();
    lastLoadedVersion = -1; // Force reload
    stateVersion = freshVersion;
    console.log(`[StateConsistency] Another instance incremented, reloading at version ${freshVersion}`);
    return false;
  } catch (error) {
    console.error("[StateConsistency] Failed to increment version:", error);
    return false;
  }
}

/**
 * Check if version has changed since last read
 * Used by repository cache invalidation
 */
export async function hasVersionChanged(): Promise<boolean> {
  const currentVersion = await loadStateVersion();
  return currentVersion !== lastReadVersion;
}

/**
 * Mark version as read (for cache invalidation tracking)
 */
export async function markVersionAsRead(): Promise<void> {
  const currentVersion = await loadStateVersion();
  lastReadVersion = currentVersion;
}

/**
 * Reset version (for testing or hard reset)
 */
export function resetVersion(): void {
  stateVersion = 0;
  lastLoadedVersion = -1;
  lastReadVersion = -1;
}
