// src/app/api/auth/world-id/verify/route.ts
// POST /api/auth/world-id/verify
// Verifies World ID 4.0 proofs using the v4 verification API

import { NextRequest, NextResponse } from "next/server";
import { getWorldIdConfig, isWorldIdEnabled } from "@/lib/worldid";

/**
 * World ID 4.0 Verification API
 * 
 * Verifies the proof returned by the World ID widget.
 * Uses the v4 verification API: POST /api/v4/verify/{rp_id}
 * 
 * Reference: https://docs.world.org/world-id/verify-with-api
 */

export async function POST(request: NextRequest) {
  if (!isWorldIdEnabled()) {
    return NextResponse.json(
      { error: "World ID not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { idkitResponse } = body;

    if (!idkitResponse) {
      return NextResponse.json(
        { error: "Missing required field: idkitResponse" },
        { status: 400 }
      );
    }

    const config = getWorldIdConfig();
    const rpId = config.rpId;

    // Verify the proof with World ID's v4 API
    const verificationResponse = await fetch(
      `https://developer.world.org/api/v4/verify/${rpId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(idkitResponse),
      }
    );

    const result = await verificationResponse.json();

    if (!verificationResponse.ok) {
      console.error("[World ID] Verification failed:", result);
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 400 }
      );
    }

    console.log("[World ID] Verification successful!", result);

    return NextResponse.json({
      success: true,
      nullifier: result.nullifier,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[World ID] Verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}