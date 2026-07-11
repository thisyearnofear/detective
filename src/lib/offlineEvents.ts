/**
 * Offline Event Repository — delayed follow-ups that fire while the player is away
 *
 * PRINCIPLE: Exactly one pending event per case (unique partial index)
 * PRINCIPLE: Metric = delivered_at → first seen_at on payload artefact
 */

import { dbQuery } from "./database";
import type { OfflineEvent, OfflineEventStatus } from "./types";

/** Default delay window: 6–12 hours. Override with OFFLINE_EVENT_MIN_MS / MAX_MS for testing. */
export function offlineDelayMs(): number {
  const min = parseInt(process.env.OFFLINE_EVENT_MIN_MS || "", 10) || 6 * 60 * 60 * 1000;
  const max = parseInt(process.env.OFFLINE_EVENT_MAX_MS || "", 10) || 12 * 60 * 60 * 1000;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function rowToEvent(row: any): OfflineEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    scheduledFor: new Date(row.scheduled_for).getTime(),
    status: row.status as OfflineEventStatus,
    payloadArtefactId: row.payload_artefact_id || null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Schedule exactly one pending offline follow-up for a case.
 * No-ops if a pending event already exists, or if any event was already delivered.
 */
export async function scheduleOfflineFollowUp(caseId: string): Promise<OfflineEvent | null> {
  const existing = await dbQuery(
    `SELECT id FROM offline_events
     WHERE case_id = $1 AND status IN ('pending', 'delivered', 'consumed')
     LIMIT 1`,
    [caseId],
  );
  if (existing.rows.length > 0) {
    return null;
  }

  const id = `oe-${caseId}-${Date.now()}`;
  const scheduledFor = new Date(Date.now() + offlineDelayMs());

  try {
    await dbQuery(
      `INSERT INTO offline_events (id, case_id, scheduled_for, status)
       VALUES ($1, $2, $3, 'pending')`,
      [id, caseId, scheduledFor],
    );
  } catch (err: any) {
    // Unique pending index race
    if (err?.message?.includes("idx_offline_events_one_pending") || err?.code === "23505") {
      return null;
    }
    throw err;
  }

  const result = await dbQuery(`SELECT * FROM offline_events WHERE id = $1`, [id]);
  console.log(
    `[offlineEvents] Scheduled ${id} for case ${caseId} at ${scheduledFor.toISOString()}`,
  );
  return result.rows[0] ? rowToEvent(result.rows[0]) : null;
}

/**
 * Load due pending events for delivery.
 */
export async function claimDueOfflineEvents(limit = 20): Promise<OfflineEvent[]> {
  const due = await dbQuery(
    `SELECT * FROM offline_events
     WHERE status = 'pending' AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT $1`,
    [limit],
  );
  return due.rows.map(rowToEvent);
}

export async function markOfflineEventDelivered(
  eventId: string,
  artefactId: string,
): Promise<void> {
  await dbQuery(
    `UPDATE offline_events
     SET status = 'delivered',
         payload_artefact_id = $2,
         delivered_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [eventId, artefactId],
  );
}

export async function markOfflineEventConsumed(eventId: string): Promise<void> {
  await dbQuery(
    `UPDATE offline_events SET status = 'consumed' WHERE id = $1 AND status = 'delivered'`,
    [eventId],
  );
}

export async function markArtefactSeen(artefactId: string): Promise<void> {
  await dbQuery(
    `UPDATE artefacts SET seen_at = NOW() WHERE id = $1 AND seen_at IS NULL`,
    [artefactId],
  );
  await dbQuery(
    `UPDATE offline_events SET status = 'consumed'
     WHERE payload_artefact_id = $1 AND status = 'delivered'`,
    [artefactId],
  );
}

export interface UnseenFollowUp {
  eventId: string;
  caseId: string;
  artefactId: string;
  body: string;
  personFid: number;
  personUsername: string;
  personDisplayName: string;
  personPfpUrl: string;
  deliveredAt: number;
  createdAt: number;
}

/**
 * Unseen offline follow-ups for an investigator (return-card source).
 */
export async function listUnseenFollowUps(
  investigatorFid: number,
): Promise<UnseenFollowUp[]> {
  const result = await dbQuery(
    `SELECT
       e.id AS event_id,
       e.case_id,
       e.delivered_at,
       a.id AS artefact_id,
       a.body,
       a.created_at AS artefact_created_at,
       p.fid AS person_fid,
       p.username AS person_username,
       p.display_name AS person_display_name,
       p.pfp_url AS person_pfp_url
     FROM offline_events e
     JOIN cases c ON c.id = e.case_id
     JOIN artefacts a ON a.id = e.payload_artefact_id
     JOIN persons p ON p.fid = c.person_fid
     WHERE c.investigator_fid = $1
       AND e.status = 'delivered'
       AND a.seen_at IS NULL
       AND a.kind = 'offline_follow_up'
     ORDER BY e.delivered_at DESC`,
    [investigatorFid],
  );

  return result.rows.map((row: any) => ({
    eventId: row.event_id,
    caseId: row.case_id,
    artefactId: row.artefact_id,
    body: row.body,
    personFid: row.person_fid,
    personUsername: row.person_username,
    personDisplayName: row.person_display_name || row.person_username,
    personPfpUrl: row.person_pfp_url || "",
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : 0,
    createdAt: new Date(row.artefact_created_at).getTime(),
  }));
}

/**
 * North-star metric: among delivered events, % with seen_at within windowMs.
 */
export async function getReturnRateMetric(windowMs = 48 * 60 * 60 * 1000): Promise<{
  eligible: number;
  returned: number;
  rate: number;
  windowMs: number;
}> {
  const result = await dbQuery<{ eligible: string; returned: string }>(
    `SELECT
       COUNT(*)::text AS eligible,
       COUNT(*) FILTER (
         WHERE a.seen_at IS NOT NULL
           AND EXTRACT(EPOCH FROM (a.seen_at - e.delivered_at)) * 1000 <= $1
       )::text AS returned
     FROM offline_events e
     JOIN artefacts a ON a.id = e.payload_artefact_id
     WHERE e.status IN ('delivered', 'consumed')
       AND e.delivered_at IS NOT NULL`,
    [windowMs],
  );
  const eligible = parseInt(result.rows[0]?.eligible || "0", 10);
  const returned = parseInt(result.rows[0]?.returned || "0", 10);
  return {
    eligible,
    returned,
    rate: eligible > 0 ? returned / eligible : 0,
    windowMs,
  };
}
