#!/usr/bin/env node
/**
 * Clear Redis state for fresh start
 * Usage: npx ts-node scripts/clear-redis.ts
 */

import { redis } from "@/lib/redis";

const keys = [
  "game:state",
  "game:players",
  "game:bots",
  "game:matches",
  "game:sessions",
  "game:state-version",
  "game:cycle-lock",
];

async function clear() {
  console.log("Clearing Redis...");
  for (const key of keys) {
    try {
      const deleted = await redis.del(key);
      console.log(`✓ Deleted: ${key}`);
    } catch (error) {
      console.error(`✗ Failed to delete ${key}:`, error);
    }
  }
  console.log("\nRedis cleared successfully");
  process.exit(0);
}

clear().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
