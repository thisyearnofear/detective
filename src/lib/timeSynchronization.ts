/**
 * Time Synchronization - Single Source of Truth for server/client time alignment
 * 
 * Core Principle: DRY - All time sync logic in one place
 * 
 * Strategy:
 * - Client syncs once per game session (on first API poll)
 * - Stores offset in memory (never changes during game)
 * - Server endTimes are absolute unix timestamps
 * - Client never adds offset to endTimes (server handles it)
 */

let timeOffsetMs = 0;
let isSynced = false;

/**
 * Initialize time offset on first successful API response
 * Called once per game session
 */
export function syncTimeOffset(serverTime: number): void {
  if (isSynced) return; // Only sync once
  
  const clientTime = Date.now();
  timeOffsetMs = serverTime - clientTime;
  isSynced = true;
  
  console.log(`[TimeSynchronization] Synced: server ${serverTime}, client ${clientTime}, offset ${timeOffsetMs}ms`);
}

/**
 * Get current time in server reference frame
 * Use this when calculating deadlines
 */
export function getServerTime(): number {
  return Date.now() + timeOffsetMs;
}

/**
 * Reset offset (e.g., when game cycle changes)
 */
export function resetTimeOffset(): void {
  isSynced = false;
  timeOffsetMs = 0;
}

/**
 * Check if we're synced with server
 */
export function isTimeSynced(): boolean {
  return isSynced;
}

/**
 * Get the current offset (for debugging)
 */
export function getTimeOffset(): number {
  return timeOffsetMs;
}
