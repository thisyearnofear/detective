import { NextRequest, NextResponse } from "next/server";
import {
  getCaseWithArtefacts,
} from "@/lib/caseRepository";
import { getPersonByFid } from "@/lib/personRepository";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[id]?fid= — case + artefacts + person
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fidParam = request.nextUrl.searchParams.get("fid");
    if (!fidParam) {
      return NextResponse.json({ error: "fid is required." }, { status: 400 });
    }
    const fid = parseInt(fidParam, 10);
    if (isNaN(fid)) {
      return NextResponse.json({ error: "Invalid fid." }, { status: 400 });
    }

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
  } catch (error) {
    console.error("[api/cases/[id] GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
