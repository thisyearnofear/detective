import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { logger } from "@/lib/logger";
import { recordTickHeartbeat } from "@/lib/cronHealth";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Offline LLM delivery may need headroom

/**
 * GET /api/cron/tick
 * 
 * Explicit game state tick - handles all phase transitions.
 * Call this from a cron job every 10-30 seconds.
 * 
 * Transitions:
 * - REGISTRATION → LIVE (when countdown expires)
 * - LIVE → FINISHED (when game timer expires)
 * - FINISHED → REGISTRATION (auto-cycle after grace period)
 * 
 * Security: Should be called by Vercel Cron or authenticated service
 */
export async function GET(request: NextRequest) {
  try {
    // Fail closed: a missing CRON_SECRET MUST NOT leave the endpoint public.
    // The old `cronSecret && ...` form silently allowed the endpoint to be hit
    // by anyone if the env var was unset, which would let a stranger spam
    // tickWorld and burn the offline event queue.
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const result = await gameManager.tickWorld();
    const duration = Date.now() - startTime;

    // Refresh the world-tick heartbeat so the /api/health probe + the
    // /api/cases lazy checker can detect a dead cron within ~20 min.
    await recordTickHeartbeat();

    return NextResponse.json({
      success: true,
      ...result,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[api/cron/tick] handler failed', { error });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
