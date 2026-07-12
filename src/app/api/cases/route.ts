import { NextRequest, NextResponse } from "next/server";
import {
  listCasesWithDetails,
  upsertCase,
} from "@/lib/caseRepository";
import { pickRandomPerson, getPersonByFid } from "@/lib/personRepository";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { maybeAlertStaleTick } from "@/lib/cronHealth";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases — list investigator's cases with person details.
 *
 * Auth: requireAuth(request). The fid comes from the verified session JWT,
 * never from the request. Per-case `investigatorFid` is verified as
 * defense-in-depth against future repo bugs.
 */
export async function GET(request: NextRequest) {
  try {
    return await logger.time("/api/cases", "GET", async () => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      const fid = auth.token.fid;

      // Lazy heartbeat probe — debounced to at most one logger.error per
      // hour, and never in dev (where the cron typically is not running).
      void maybeAlertStaleTick();

      const cases = await listCasesWithDetails(fid);
      return NextResponse.json({ cases });
    });
  } catch (error) {
    logger.error("[api/cases GET] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cases
 * Body: { personFid? } — open case on personFid, or pick a random subject.
 *
 * Auth: caller identity comes from the session JWT.
 */
export async function POST(request: NextRequest) {
  try {
    return await logger.time("/api/cases", "POST", async () => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      const fid = auth.token.fid;

      const body = await request.json().catch(() => ({}));
      const personFid =
        body.personFid != null
          ? typeof body.personFid === "number"
            ? body.personFid
            : parseInt(body.personFid, 10)
          : null;

      let resolvedPersonFid = personFid;
      if (resolvedPersonFid == null || isNaN(resolvedPersonFid)) {
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
        resolvedPersonFid = person.fid;
      }

      if (resolvedPersonFid === fid) {
        return NextResponse.json(
          { error: "Cannot investigate yourself." },
          { status: 400 },
        );
      }

      const person = await getPersonByFid(resolvedPersonFid);
      if (!person) {
        return NextResponse.json({ error: "Person not found." }, { status: 404 });
      }

      const c = await upsertCase(fid, resolvedPersonFid);
      return NextResponse.json({
        case: c,
        person: {
          fid: person.fid,
          username: person.username,
          displayName: person.displayName,
          pfpUrl: person.pfpUrl,
        },
      });
    });
  } catch (error) {
    logger.error("[api/cases POST] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
