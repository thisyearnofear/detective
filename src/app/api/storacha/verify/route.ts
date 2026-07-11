// GET /api/storacha/verify?cid=<CID>
// Verify that data exists at a given CID on IPFS/Storacha

import { NextRequest, NextResponse } from "next/server";
import { isResearchPlatformEnabled } from "@/platform";
import { verifyStoredData } from "@/platform/storacha";

export async function GET(request: NextRequest) {
  if (!isResearchPlatformEnabled()) {
    return NextResponse.json({ error: "Research platform disabled" }, { status: 404 });
  }

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
