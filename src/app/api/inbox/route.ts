import { NextRequest, NextResponse } from "next/server";
import { listUnseenFollowUps, markArtefactSeen } from "@/lib/offlineEvents";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox — unseen offline follow-ups for the return card.
 *
 * Auth: requireAuth(request).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const fid = auth.token.fid;

    const items = await listUnseenFollowUps(fid);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    logger.error("[api/inbox GET] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/inbox
 * Body: { artefactId } — mark offline follow-up as seen (opens the clue).
 *
 * Auth: requireAuth(request). `markArtefactSeen` does its own ownership
 * check (defense in depth) and returns { seen, reason? }.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const fid = auth.token.fid;

    const body = await request.json().catch(() => ({}));
    const artefactId = body.artefactId;
    if (!artefactId || typeof artefactId !== "string") {
      return NextResponse.json(
        { error: "artefactId is required." },
        { status: 400 },
      );
    }

    const result = await markArtefactSeen(artefactId, fid);
    if (!result.seen) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Artefact not found." }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    return NextResponse.json({ success: true, artefactId });
  } catch (error) {
    logger.error("[api/inbox POST] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
