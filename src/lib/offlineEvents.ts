/**
 * Offline Event Repository — delayed follow-ups that fire while the player is away
 *
 * PRINCIPLE: At most one pending event per case (unique partial index)
 * PRINCIPLE: At most one event per kind per case (follow_up → echo chain)
 * PRINCIPLE: Metric = delivered_at → first seen_at on payload artefact
 */

import { dbQuery } from "./database";
import type { OfflineEvent, OfflineEventKind, OfflineEventStatus } from "./types";

const MAX_EVENTS_PER_CASE = 2;

/** First leave follow-up: 6–12h. Override with OFFLINE_EVENT_MIN_MS / MAX_MS. */
export function offlineDelayMs(): number {
  return randomDelayMs(
    process.env.OFFLINE_EVENT_MIN_MS,
    process.env.OFFLINE_EVENT_MAX_MS,
    6 * 60 * 60 * 1000,
    12 * 60 * 60 * 1000,
  );
}

/** Second echo: 18–36h after first delivery. Override with OFFLINE_ECHO_MIN_MS / MAX_MS. */
export function offlineEchoDelayMs(): number {
  return randomDelayMs(
    process.env.OFFLINE_ECHO_MIN_MS,
    process.env.OFFLINE_ECHO_MAX_MS,
    18 * 60 * 60 * 1000,
    36 * 60 * 60 * 1000,
  );
}

function randomDelayMs(
  minEnv: string | undefined,
  maxEnv: string | undefined,
  defaultMin: number,
  defaultMax: number,
): number {
  const min = parseInt(minEnv || "", 10) || defaultMin;
  const max = parseInt(maxEnv || "", 10) || defaultMax;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function delayForKind(kind: OfflineEventKind): number {
  return kind === "echo" ? offlineEchoDelayMs() : offlineDelayMs();
}

export function artefactKindForEvent(kind: OfflineEventKind): "offline_follow_up" | "offline_echo" {
  return kind === "echo" ? "offline_echo" : "offline_follow_up";
}

function rowToEvent(row: any): OfflineEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    kind: (row.kind as OfflineEventKind) || "follow_up",
    scheduledFor: new Date(row.scheduled_for).getTime(),
    status: row.status as OfflineEventStatus,
    payloadArtefactId: row.payload_artefact_id || null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Schedule a pending offline event of the given kind.
 * No-ops if pending exists, kind already exists, or case is at the event cap.
 */
export async function scheduleOfflineEvent(
  caseId: string,
  kind: OfflineEventKind = "follow_up",
): Promise<OfflineEvent | null> {
  const pending = await dbQuery(
    `SELECT id FROM offline_events WHERE case_id = $1 AND status = 'pending' LIMIT 1`,
    [caseId],
  );
  if (pending.rows.length > 0) return null;

  const sameKind = await dbQuery(
    `SELECT id FROM offline_events WHERE case_id = $1 AND kind = $2 LIMIT 1`,
    [caseId, kind],
  );
  if (sameKind.rows.length > 0) return null;

  const total = await dbQuery(
    `SELECT COUNT(*)::text AS n FROM offline_events WHERE case_id = $1`,
    [caseId],
  );
  if (parseInt(total.rows[0]?.n || "0", 10) >= MAX_EVENTS_PER_CASE) {
    return null;
  }

  const id = `oe-${kind}-${caseId}-${Date.now()}`;
  const scheduledFor = new Date(Date.now() + delayForKind(kind));

  try {
    await dbQuery(
      `INSERT INTO offline_events (id, case_id, kind, scheduled_for, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [id, caseId, kind, scheduledFor],
    );
  } catch (err: any) {
    if (
      err?.message?.includes("idx_offline_events_one_pending") ||
      err?.message?.includes("idx_offline_events_one_kind") ||
      err?.code === "23505"
    ) {
      return null;
    }
    throw err;
  }

  const result = await dbQuery(`SELECT * FROM offline_events WHERE id = $1`, [id]);
  console.log(
    `[offlineEvents] Scheduled ${kind} ${id} for case ${caseId} at ${scheduledFor.toISOString()}`,
  );
  return result.rows[0] ? rowToEvent(result.rows[0]) : null;
}

/** Leave-path: first follow-up only. */
export async function scheduleOfflineFollowUp(caseId: string): Promise<OfflineEvent | null> {
  return scheduleOfflineEvent(caseId, "follow_up");
}

/**
 * After a follow_up is delivered, deepen the loop with one echo (variable longer cadence).
 */
export async function maybeScheduleOfflineEcho(
  caseId: string,
  deliveredKind: OfflineEventKind,
): Promise<OfflineEvent | null> {
  if (deliveredKind !== "follow_up") return null;
  return scheduleOfflineEvent(caseId, "echo");
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

/**
 * Mark an artefact as seen. Returns the outcome so the caller can surface a
 * 404 / 403 instead of silently no-op'ing.
 *
 * Security: the function takes the caller's `investigatorFid` (from a verified
 * JWT) and refuses to mark artefacts that don't belong to one of their cases.
 * Without this, any caller could poison the return-rate metric by marking
 * other users' artefacts as seen.
 */
export type MarkArtefactSeenResult =
  | { seen: true }
  | { seen: false; reason: "not_found" | "forbidden" };

export async function markArtefactSeen(
  artefactId: string,
  investigatorFid: number,
): Promise<MarkArtefactSeenResult> {
  const owner = await dbQuery<{ investigator_fid: number }>(
    `SELECT c.investigator_fid
       FROM artefacts a
       JOIN cases c ON c.id = a.case_id
       WHERE a.id = $1`,
    [artefactId],
  );
  if (owner.rows.length === 0) return { seen: false, reason: "not_found" };
  if (owner.rows[0].investigator_fid !== investigatorFid) {
    return { seen: false, reason: "forbidden" };
  }

  await dbQuery(
    `UPDATE artefacts SET seen_at = NOW() WHERE id = $1 AND seen_at IS NULL`,
    [artefactId],
  );
  await dbQuery(
    `UPDATE offline_events SET status = 'consumed'
     WHERE payload_artefact_id = $1 AND status = 'delivered'`,
    [artefactId],
  );
  return { seen: true };
}

export interface UnseenFollowUp {
  eventId: string;
  caseId: string;
  artefactId: string;
  kind: OfflineEventKind;
  body: string;
  personFid: number;
  personUsername: string;
  personDisplayName: string;
  personPfpUrl: string;
  deliveredAt: number;
  createdAt: number;
}

/**
 * Unseen offline artefacts for an investigator (return-card source).
 */
export async function listUnseenFollowUps(
  investigatorFid: number,
): Promise<UnseenFollowUp[]> {
  const result = await dbQuery(
    `SELECT
       e.id AS event_id,
       e.case_id,
       e.kind AS event_kind,
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
       AND a.kind IN ('offline_follow_up', 'offline_echo')
     ORDER BY e.delivered_at DESC`,
    [investigatorFid],
  );

  return result.rows.map((row: any) => ({
    eventId: row.event_id,
    caseId: row.case_id,
    artefactId: row.artefact_id,
    kind: (row.event_kind as OfflineEventKind) || "follow_up",
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
