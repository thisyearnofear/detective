// src/app/api/cron/tick/route.ts
/**
 * Game State Tick - Called by Vercel Cron every 10 seconds
 * 
 * Handles all phase transitions:
 * - REGISTRATION → LIVE (when countdown expires)
 * - LIVE → FINISHED (when game timer expires)  
 * - FINISHED → REGISTRATION (auto-cycle after grace period)
 * 
 * This decouples state transitions from read operations,
 * making the system more predictable and debuggable.
 */

import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    // Verify cron secret in production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await gameManager.tickGameState();
    
    if (result.transitioned) {
      console.log(`[Cron/Tick] State transitioned: ${result.from} → ${result.to}`);
    }

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Cron/Tick] Error:", error);
    return NextResponse.json(
      { error: "Tick failed", message: String(error) },
      { status: 500 }
    );
  }
}
