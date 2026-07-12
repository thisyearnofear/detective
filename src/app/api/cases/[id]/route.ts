import { NextRequest, NextResponse } from "next/server";
import {
  getCaseWithArtefacts,
} from "@/lib/caseRepository";
import { getPersonByFid } from "@/lib/personRepository";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[id] — case + artefacts + person.
 *
 * Auth: requireAuth(request). The per-case `investigatorFid` is verified
 * against the verified fid as defense-in-depth.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await logger.time("/api/cases/[id]", "GET", async () => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      const fid = auth.token.fid;

      const { id } = await params;
      const packed = await getCaseWithArtefacts(id);
      if (!packed) {
        return NextResponse.json({ error: "Case not found." }, { status: 404 });
      }
      if (packed.case.investigatorFid !== fid) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }

      const person = await getPersonByFid(packed.case.personFid);
      return NextResponse.json({
        case: packed.case,
        artefacts: packed.artefacts,
        person: person
          ? {
              fid: person.fid,
              username: person.username,
              displayName: person.displayName,
              pfpUrl: person.pfpUrl,
            }
          : null,
      });
    });
  } catch (error) {
    logger.error("[api/cases/[id] GET] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
