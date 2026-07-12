import { NextRequest, NextResponse } from "next/server";
import {
  appendMessageArtefact,
  artefactsToMessages,
  getCaseById,
  listArtefacts,
} from "@/lib/caseRepository";
import { personToBot, getPersonByFid } from "@/lib/personRepository";
import { generateBotResponse } from "@/lib/inference";
import { calculateTypingDelay } from "@/lib/typingDelay";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cases/[id]/messages
 * Body: { text } — investigator message + persona reply.
 *
 * Auth: requireAuth(request). The fid comes from the verified session JWT.
 * The per-case `investigatorFid` is verified as defense-in-depth.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const fid = auth.token.fid;

    const { id: caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "text is required." },
        { status: 400 },
      );
    }

    const c = await getCaseById(caseId);
    if (!c) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    if (c.investigatorFid !== fid) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const investigator = await getPersonByFid(fid);
    const person = await getPersonByFid(c.personFid);
    const investigatorUsername = investigator?.username || `fid:${fid}`;

    const trimmed = text.slice(0, 500);
    const playerMessage = {
      id: `msg-${Date.now()}-${fid}`,
      sender: { fid, username: investigatorUsername },
      text: trimmed,
      timestamp: Date.now(),
    };

    await appendMessageArtefact({
      caseId,
      message: playerMessage,
      investigatorFid: fid,
      personFid: c.personFid,
    });

    const bot = await personToBot(c.personFid);
    if (!bot) {
      return NextResponse.json({
        success: true,
        message: playerMessage,
        reply: null,
      });
    }

    const artefacts = await listArtefacts(caseId);
    const history = artefactsToMessages(
      artefacts,
      fid,
      c.personFid,
      investigatorUsername,
      person?.username || bot.username,
    );

    const replyText = await generateBotResponse(bot, history, caseId);
    const personality = bot.personality as { communicationStyle?: string } | undefined;
    const style =
      (personality?.communicationStyle as
        | "terse"
        | "conversational"
        | "verbose"
        | undefined) || "conversational";
    const duration = Math.min(calculateTypingDelay(replyText, style, trimmed), 8000);

    const replyMessage = {
      id: `msg-${Date.now()}-${bot.fid}`,
      sender: { fid: bot.fid, username: bot.username },
      text: replyText,
      timestamp: Date.now(),
    };

    await appendMessageArtefact({
      caseId,
      message: replyMessage,
      investigatorFid: fid,
      personFid: c.personFid,
    });

    return NextResponse.json({
      success: true,
      message: playerMessage,
      reply: replyMessage,
      typingIndicator: { isTyping: true, duration },
    });
  } catch (error) {
    logger.error("[api/cases/[id]/messages] handler failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
