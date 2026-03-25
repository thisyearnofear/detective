// src/app/api/storacha/verify/route.ts
// GET /api/storacha/verify?cid=<CID>
// Verify that data exists at a given CID on IPFS/Storacha

import { NextRequest, NextResponse } from "next/server";
import { verifyStoredData } from "@/lib/storacha";

export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get("cid");

  if (!cid) {
    return NextResponse.json(
      { error: "Missing required query param: cid" },
      { status: 400 }
    );
  }

  try {
    const result = await verifyStoredData(cid);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Storacha verify error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
