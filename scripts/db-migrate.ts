#!/usr/bin/env bun
/**
 * Standalone DDL migration script (Phase 1).
 *
 * Runs the same schema as the runtime `initialize()` in src/lib/database.ts,
 * but outside of the Next.js app context. Useful for:
 *   - Bootstrapping a fresh database before the app starts.
 *   - CI / smoke tests that want to assert schema without booting Next.
 *   - Vercel post-deploy hooks (if you want to decouple schema from app boot).
 *
 * Idempotent — all statements use IF NOT EXISTS, so re-runs are safe.
 *
 * Usage:
 *   bun run db:migrate
 *   # or
 *   DATABASE_URL=postgres://... bun scripts/db-migrate.ts
 *
 * Exit codes:
 *   0 = success
 *   1 = missing DATABASE_URL
 *   2 = migration error
 */

import { Pool } from "pg";
import {
  INIT_DDL,
  INIT_DDL_ALTER,
  INIT_DDL_FINAL_INDEX,
} from "../src/lib/database";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  console.log("\nSet it in your environment or .env file before running migrations.");
  process.exit(1);
}

async function migrate(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });

  try {
    // 1. Connectivity check — fail fast if the DB is unreachable.
    const ping = await pool.query<{ now: string }>("SELECT NOW() as now");
    console.log(`✅ Connected to database (server time: ${ping.rows[0].now})`);

    // 2. Run the DDL blocks in order. Each is idempotent.
    console.log("🔄 Applying schema (INIT_DDL)...");
    await pool.query(INIT_DDL);
    console.log("   ✓ base tables + indexes");

    console.log("🔄 Applying column backfills (INIT_DDL_ALTER)...");
    await pool.query(INIT_DDL_ALTER);
    console.log("   ✓ legacy column adds (no-op on fresh DBs)");

    console.log("🔄 Applying final unique index (INIT_DDL_FINAL_INDEX)...");
    await pool.query(INIT_DDL_FINAL_INDEX);
    console.log("   ✓ offline_events uniqueness");

    // 3. Sanity report — list the tables we own. Useful for CI smoke tests.
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name`,
    );
    console.log(`\n📊 Schema has ${tables.rows.length} public tables:`);
    for (const row of tables.rows) {
      console.log(`   - ${row.table_name}`);
    }

    console.log("\n✅ Migration complete");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

migrate();
