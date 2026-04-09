import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // 10 seconds max

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
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const result = await gameManager.tickGameState();
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      ...result,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/cron/tick] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
