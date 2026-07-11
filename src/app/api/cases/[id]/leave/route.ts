import { NextRequest, NextResponse } from "next/server";
import { getCaseById, listArtefacts } from "@/lib/caseRepository";
import { scheduleOfflineFollowUp } from "@/lib/offlineEvents";

export const dynamic = "force-dynamic";

/**
 * POST /api/cases/[id]/leave
 * Body: { fid } — investigator steps away; schedule offline follow-up if exchange exists
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;
    const body = await request.json();
    const fid = typeof body.fid === "number" ? body.fid : parseInt(body.fid, 10);
    if (isNaN(fid)) {
      return NextResponse.json({ error: "fid is required." }, { status: 400 });
    }

    const c = await getCaseById(caseId);
    if (!c) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    if (c.investigatorFid !== fid) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const artefacts = await listArtefacts(caseId);
    const hasExchange = artefacts.some((a) => a.kind === "message");
    if (!hasExchange) {
      return NextResponse.json({
        success: true,
        scheduled: false,
        reason: "no_exchange",
      });
    }

    const event = await scheduleOfflineFollowUp(caseId);
    return NextResponse.json({
      success: true,
      scheduled: !!event,
      eventId: event?.id ?? null,
      scheduledFor: event?.scheduledFor ?? null,
    });
  } catch (error) {
    console.error("[api/cases/[id]/leave]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
