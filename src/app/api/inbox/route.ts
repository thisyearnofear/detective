import { NextRequest, NextResponse } from "next/server";
import { listUnseenFollowUps, markArtefactSeen } from "@/lib/offlineEvents";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox?fid=
 * Unseen offline follow-ups for the return card.
 */
export async function GET(request: NextRequest) {
  try {
    const fidParam = request.nextUrl.searchParams.get("fid");
    if (!fidParam) {
      return NextResponse.json({ error: "fid is required." }, { status: 400 });
    }
    const fid = parseInt(fidParam, 10);
    if (isNaN(fid)) {
      return NextResponse.json({ error: "Invalid fid." }, { status: 400 });
    }

    const items = await listUnseenFollowUps(fid);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("[api/inbox GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/inbox
 * Body: { artefactId } — mark offline follow-up as seen (opens the clue).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artefactId } = body;
    if (!artefactId || typeof artefactId !== "string") {
      return NextResponse.json(
        { error: "artefactId is required." },
        { status: 400 },
      );
    }

    await markArtefactSeen(artefactId);
    return NextResponse.json({ success: true, artefactId });
  } catch (error) {
    console.error("[api/inbox POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
