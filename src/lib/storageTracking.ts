// src/lib/storageTracking.ts
/**
 * Storage Tracking Module - Tracks all Storacha/IPFS uploads in Redis
 * 
 * Provides:
 * - Recording upload metadata for analytics
 * - Storage statistics and queries
 * - Data provenance for audit trails
 * 
 * Single source of truth for all storage-related data
 */

import { redis } from './redis';
import type { StorageUploadRecord, StorageStats, StorageUploadType } from './types';

const STORAGE_KEYS = {
  UPLOADS_LIST: 'storage:uploads',
  UPLOADS_BY_CYCLE: (cycleId: string) => `storage:cycle:${cycleId}`,
  STATS: 'storage:stats',
} as const;

/**
 * Record a new upload to Redis for tracking
 */
export async function recordUpload(
  record: Omit<StorageUploadRecord, 'id'>
): Promise<string> {
  const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  const fullRecord: StorageUploadRecord = {
    ...record,
    id,
  };

  // Add to main list
  await redis.lpush(STORAGE_KEYS.UPLOADS_LIST, JSON.stringify(fullRecord));
  
  // Add to cycle-specific list
  await redis.lpush(
    STORAGE_KEYS.UPLOADS_BY_CYCLE(record.cycleId),
    JSON.stringify(fullRecord)
  );

  // Update stats counters
  await incrementStats(record.type, record.sizeBytes);

  return id;
}

/**
 * Get all uploads with optional filtering
 */
export async function getUploads(options?: {
  cycleId?: string;
  type?: StorageUploadType;
  limit?: number;
  offset?: number;
}): Promise<StorageUploadRecord[]> {
  const key = options?.cycleId 
    ? STORAGE_KEYS.UPLOADS_BY_CYCLE(options.cycleId)
    : STORAGE_KEYS.UPLOADS_LIST;

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const records = await redis.lrange(key, offset, offset + limit - 1);
  
  let uploads = records.map(r => {
    try {
      return JSON.parse(r) as StorageUploadRecord;
    } catch {
      return null;
    }
  }).filter((r): r is StorageUploadRecord => r !== null);

  // Filter by type if specified
  if (options?.type) {
    uploads = uploads.filter(u => u.type === options.type);
  }

  return uploads;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  const statsJson = await redis.get(STORAGE_KEYS.STATS);
  
  if (!statsJson) {
    return {
      totalUploads: 0,
      totalSizeBytes: 0,
      uploadsByType: {
        bot_training_data: 0,
        game_snapshot: 0,
        match_provenance: 0,
        leaderboard: 0,
      },
      uploadsByCycle: 0,
      lastUploadAt: null,
      oldestUploadAt: null,
    };
  }

  const stats = JSON.parse(statsJson);
  
  // Calculate unique cycles
  const uploads = await getUploads({ limit: 1000 });
  const uniqueCycles = new Set(uploads.map(u => u.cycleId));

  return {
    totalUploads: stats.totalUploads ?? 0,
    totalSizeBytes: stats.totalSizeBytes ?? 0,
    uploadsByType: stats.uploadsByType ?? {
      bot_training_data: 0,
      game_snapshot: 0,
      match_provenance: 0,
      leaderboard: 0,
    },
    uploadsByCycle: uniqueCycles.size,
    lastUploadAt: stats.lastUploadAt,
    oldestUploadAt: stats.oldestUploadAt,
  };
}

/**
 * Get uploads for a specific cycle
 */
export async function getUploadsByCycle(cycleId: string): Promise<StorageUploadRecord[]> {
  return getUploads({ cycleId });
}

/**
 * Get the latest upload for a given type
 */
export async function getLatestUpload(type?: StorageUploadType): Promise<StorageUploadRecord | null> {
  const uploads = await getUploads({ type, limit: 1 });
  return uploads[0] ?? null;
}

/**
 * Increment stats counters (internal)
 */
async function incrementStats(type: StorageUploadType, sizeBytes: number): Promise<void> {
  const statsJson = await redis.get(STORAGE_KEYS.STATS);
  const current = statsJson ? JSON.parse(statsJson) : {
    totalUploads: 0,
    totalSizeBytes: 0,
    uploadsByType: {
      bot_training_data: 0,
      game_snapshot: 0,
      match_provenance: 0,
      leaderboard: 0,
    },
    lastUploadAt: null,
    oldestUploadAt: null,
  };

  const now = Date.now();
  
  current.totalUploads += 1;
  current.totalSizeBytes += sizeBytes;
  current.uploadsByType[type] = (current.uploadsByType[type] ?? 0) + 1;
  current.lastUploadAt = now;
  current.oldestUploadAt = current.oldestUploadAt ?? now;

  await redis.set(STORAGE_KEYS.STATS, JSON.stringify(current));
}

/**
 * Check if storage tracking is available
 */
export function isStorageTrackingEnabled(): boolean {
  return !!redis && !!process.env.STORACHA_ENABLED;
}