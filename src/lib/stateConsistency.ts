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
import { randomUUID } from "crypto";

// Generate a unique ID for this serverless instance
// In serverless environments, each cold start gets a new ID
const INSTANCE_ID = randomUUID();

let stateVersion = 0;
let lastLoadedVersion = -1;

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
export async function markCacheFresh(version: number): Promise<void> {
  lastLoadedVersion = version;
  stateVersion = version;
  // Also mark as read in Redis to prevent immediate invalidation
  await persistence.setLastReadVersion(INSTANCE_ID, version);
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
 * Now uses Redis for serverless compatibility
 */
export async function hasVersionChanged(): Promise<boolean> {
  const currentVersion = await loadStateVersion();
  const lastRead = await persistence.getLastReadVersion(INSTANCE_ID);
  
  console.log(`[StateConsistency] Version check: current=${currentVersion}, lastRead=${lastRead}, instanceId=${INSTANCE_ID.slice(0, 8)}`);
  
  // If this is the first read (null), consider it changed to trigger initial load
  if (lastRead === null) {
    console.log(`[StateConsistency] First read for instance, triggering load`);
    return true;
  }
  
  const hasChanged = currentVersion !== lastRead;
  if (hasChanged) {
    console.log(`[StateConsistency] Version changed: ${lastRead} → ${currentVersion}`);
  }
  
  return hasChanged;
}

/**
 * Mark version as read (for cache invalidation tracking)
 * Now persists to Redis for serverless compatibility
 */
export async function markVersionAsRead(): Promise<void> {
  const currentVersion = await loadStateVersion();
  await persistence.setLastReadVersion(INSTANCE_ID, currentVersion);
}

/**
 * Reset version (for testing or hard reset)
 */
export function resetVersion(): void {
  stateVersion = 0;
  lastLoadedVersion = -1;
  // Note: Redis-tracked lastReadVersion is not reset here (per-instance)
}
