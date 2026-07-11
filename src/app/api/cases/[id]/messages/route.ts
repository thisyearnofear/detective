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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cases/[id]/messages
 * Body: { fid, text } — investigator message + persona reply
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;
    const body = await request.json();
    const fid = typeof body.fid === "number" ? body.fid : parseInt(body.fid, 10);
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (isNaN(fid) || !text) {
      return NextResponse.json(
        { error: "fid and text are required." },
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
    console.error("[api/cases/[id]/messages]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
