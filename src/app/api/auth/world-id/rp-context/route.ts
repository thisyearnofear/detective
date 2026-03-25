// src/app/api/auth/world-id/rp-context/route.ts
// GET /api/auth/world-id/rp-context
// Returns RP signature context for World ID verification

import { NextRequest, NextResponse } from "next/server";
import { generateRPSignature, getWorldIdConfig, isWorldIdEnabled } from "@/lib/worldid";

export async function GET(request: NextRequest) {
  if (!isWorldIdEnabled()) {
    return NextResponse.json(
      { error: "World ID not configured" },
      { status: 503 }
    );
  }

  const action = request.nextUrl.searchParams.get("action") || "play-detective";
  const signature = generateRPSignature(action);

  if (!signature) {
    return NextResponse.json(
      { error: "Failed to generate signature" },
      { status: 500 }
    );
  }

  const config = getWorldIdConfig();

  return NextResponse.json({
    rp_id: config.rpId,
    sig: signature.sig,
    nonce: signature.nonce,
    created_at: Date.now(),  // Current timestamp as number
    expires_at: Date.now() + 60000,  // 60 seconds from now
  });
}