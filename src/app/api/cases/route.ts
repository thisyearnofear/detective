import { NextRequest, NextResponse } from "next/server";
import {
  listCasesWithDetails,
  upsertCase,
} from "@/lib/caseRepository";
import { pickRandomPerson, getPersonByFid } from "@/lib/personRepository";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases?fid= — list investigator's cases with person details
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

    const cases = await listCasesWithDetails(fid);
    return NextResponse.json({ cases });
  } catch (error) {
    console.error("[api/cases GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cases
 * Body: { fid, personFid? } — open case on personFid, or pick a random subject
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fid = typeof body.fid === "number" ? body.fid : parseInt(body.fid, 10);
    if (isNaN(fid)) {
      return NextResponse.json({ error: "fid is required." }, { status: 400 });
    }

    let personFid =
      body.personFid != null
        ? typeof body.personFid === "number"
          ? body.personFid
          : parseInt(body.personFid, 10)
        : null;

    if (personFid == null || isNaN(personFid)) {
      const person = await pickRandomPerson(fid);
      if (!person) {
        return NextResponse.json(
          {
            error:
              "No subjects available yet. Persons appear after investigators register with cast history.",
          },
          { status: 404 },
        );
      }
      personFid = person.fid;
    }

    if (personFid === fid) {
      return NextResponse.json(
        { error: "Cannot investigate yourself." },
        { status: 400 },
      );
    }

    const person = await getPersonByFid(personFid);
    if (!person) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    const c = await upsertCase(fid, personFid);
    return NextResponse.json({
      case: c,
      person: {
        fid: person.fid,
        username: person.username,
        displayName: person.displayName,
        pfpUrl: person.pfpUrl,
      },
    });
  } catch (error) {
    console.error("[api/cases POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
