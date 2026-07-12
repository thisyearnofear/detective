/**
 * GET /api/health
 *
 * Public liveness probe — no auth, returns the world-tick heartbeat's
 * freshness. Designed for BetterUptime / UptimeRobot / similar external
 * monitors. A `200 ok` means the world-tick cron has fired within the last
 * 20 minutes; `503 stale` means either Redis is down OR the cron died.
 *
 * We deliberately do NOT leak more detail (cycle id, last tick value, etc.)
 * on a public endpoint — anonymous callers don't need it, and authenticated
 * callers who do can compute the same view from the admin ring buffer.
 */
import { NextResponse } from "next/server";
import { getTickHeartbeat } from "@/lib/cronHealth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const hb = await getTickHeartbeat();
  if (hb.isFresh) {
    return NextResponse.json({
      status: "ok",
      lastTickAgoMs: hb.ageMs,
    });
  }
  return NextResponse.json(
    {
      status: "stale",
      lastTickAgoMs: hb.ageMs,
      lastTickAt: hb.lastTickAtMs
        ? new Date(hb.lastTickAtMs).toISOString()
        : null,
    },
    { status: 503 },
  );
}
