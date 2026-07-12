/**
 * World clock helpers — offline event delivery on each tick
 */

import { generateBotResponse } from "./inference";
import { personToBot } from "./personRepository";
import { logger } from "./logger";
import {
  artefactsToMessages,
  getCaseById,
  listArtefacts,
} from "./caseRepository";
import { dbQuery } from "./database";
import {
  artefactKindForEvent,
  claimDueOfflineEvents,
  maybeScheduleOfflineEcho,
} from "./offlineEvents";
import type { ChatMessage } from "./types";

/**
 * Deliver due offline events: generate persona-grounded reply from artefact history.
 * After a follow_up lands, schedules one echo at a longer cadence.
 */
export async function deliverDueOfflineEvents(): Promise<{
  claimed: number;
  delivered: number;
  errors: number;
  echoesScheduled: number;
}> {
  let delivered = 0;
  let errors = 0;
  let echoesScheduled = 0;

  const events = await claimDueOfflineEvents(20);
  const claimed = events.length;

  for (const event of events) {
    try {
      const c = await getCaseById(event.caseId);
      if (!c) {
        console.warn(`[worldClock] Case ${event.caseId} missing, skipping ${event.id}`);
        errors++;
        continue;
      }

      const bot = await personToBot(c.personFid);
      if (!bot) {
        console.warn(`[worldClock] No bot/person for fid ${c.personFid}`);
        errors++;
        continue;
      }

      const artefacts = await listArtefacts(event.caseId);
      const messages: ChatMessage[] = artefactsToMessages(
        artefacts,
        c.investigatorFid,
        c.personFid,
        "investigator",
        bot.username,
      );

      if (messages.length === 0) {
        console.warn(`[worldClock] No exchange history for ${event.caseId}, skipping`);
        errors++;
        continue;
      }

      const replyText = await generateBotResponse(bot, messages, event.caseId, {
        offlineKind: event.kind,
      });
      const artefactKind = artefactKindForEvent(event.kind);
      const artefactId = `art-offline-${event.id}`;

      await dbQuery(
        `INSERT INTO artefacts (id, case_id, kind, author, body, created_at)
         VALUES ($1, $2, $3, 'person', $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [artefactId, event.caseId, artefactKind, replyText],
      );

      await dbQuery(
        `UPDATE cases SET last_activity_at = NOW(), state = 'open' WHERE id = $1`,
        [event.caseId],
      );

      // Atomic: only succeeds if still pending
      const marked = await dbQuery(
        `UPDATE offline_events
         SET status = 'delivered',
             payload_artefact_id = $2,
             delivered_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [event.id, artefactId],
      );
      if (marked.rowCount === 0) {
        continue;
      }
      delivered++;
      console.log(
        `[worldClock] Delivered ${event.kind} ${artefactId} for case ${event.caseId}`,
      );

      const echo = await maybeScheduleOfflineEcho(event.caseId, event.kind);
      if (echo) echoesScheduled++;
    } catch (err) {
      logger.error(`Failed to deliver ${event.id}`, {
        apiName: "deliverDueOfflineEvents",
        eventId: event.id,
        caseId: event.caseId,
        kind: event.kind,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  return { claimed, delivered, errors, echoesScheduled };
}
