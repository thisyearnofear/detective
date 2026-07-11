/**
 * Case Repository — durable cases, artefacts, commitments (Postgres SoT)
 *
 * PRINCIPLE: DRY — one case per investigator × person
 * PRINCIPLE: ENHANCEMENT FIRST — maps from Match / ChatMessage / Vote at boundary
 */

import { dbQuery } from "./database";
import type {
  Artefact,
  ArtefactAuthor,
  ArtefactKind,
  Case,
  CaseState,
  ChatMessage,
  Commitment,
  CommitmentKind,
  Match,
} from "./types";

export function caseIdFor(investigatorFid: number, personFid: number): string {
  return `case-${investigatorFid}-${personFid}`;
}

function rowToCase(row: any): Case {
  return {
    id: row.id,
    investigatorFid: row.investigator_fid,
    personFid: row.person_fid,
    state: (row.state || "open") as CaseState,
    openedAt: new Date(row.opened_at).getTime(),
    lastActivityAt: new Date(row.last_activity_at).getTime(),
  };
}

function rowToArtefact(row: any): Artefact {
  return {
    id: row.id,
    caseId: row.case_id,
    kind: row.kind as ArtefactKind,
    author: row.author as ArtefactAuthor,
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    seenAt: row.seen_at ? new Date(row.seen_at).getTime() : null,
  };
}

function rowToCommitment(row: any): Commitment {
  return {
    id: row.id,
    caseId: row.case_id,
    investigatorFid: row.investigator_fid,
    kind: row.kind as CommitmentKind,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Upsert a Case from a live Match (investigator × opponent person).
 */
export async function upsertCaseFromMatch(match: Match): Promise<Case> {
  const investigatorFid = match.player.fid;
  const personFid = match.opponent.fid;
  const id = caseIdFor(investigatorFid, personFid);
  const now = new Date();

  await dbQuery(
    `INSERT INTO cases (id, investigator_fid, person_fid, state, opened_at, last_activity_at)
     VALUES ($1, $2, $3, 'open', $4, $4)
     ON CONFLICT (investigator_fid, person_fid) DO UPDATE SET
       last_activity_at = EXCLUDED.last_activity_at,
       state = CASE
         WHEN cases.state = 'archived' THEN 'open'
         ELSE cases.state
       END`,
    [id, investigatorFid, personFid, now],
  );

  const result = await dbQuery(`SELECT * FROM cases WHERE id = $1`, [id]);
  return rowToCase(result.rows[0]);
}

export async function getCaseById(caseId: string): Promise<Case | null> {
  const result = await dbQuery(`SELECT * FROM cases WHERE id = $1`, [caseId]);
  return result.rows[0] ? rowToCase(result.rows[0]) : null;
}

export async function getCaseForPair(
  investigatorFid: number,
  personFid: number,
): Promise<Case | null> {
  return getCaseById(caseIdFor(investigatorFid, personFid));
}

export async function listOpenCases(limit = 100): Promise<Case[]> {
  const result = await dbQuery(
    `SELECT * FROM cases WHERE state = 'open'
     ORDER BY last_activity_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(rowToCase);
}

export async function listCasesForInvestigator(
  investigatorFid: number,
  limit = 50,
): Promise<Case[]> {
  const result = await dbQuery(
    `SELECT * FROM cases WHERE investigator_fid = $1
     ORDER BY last_activity_at DESC LIMIT $2`,
    [investigatorFid, limit],
  );
  return result.rows.map(rowToCase);
}

/**
 * Append a message artefact. Author inferred from senderFid vs case parties.
 */
export async function appendMessageArtefact(params: {
  caseId: string;
  message: ChatMessage;
  investigatorFid: number;
  personFid: number;
}): Promise<Artefact> {
  const { caseId, message, investigatorFid, personFid } = params;
  const author: ArtefactAuthor =
    message.sender.fid === investigatorFid
      ? "investigator"
      : message.sender.fid === personFid
        ? "person"
        : "system";

  await dbQuery(
    `INSERT INTO artefacts (id, case_id, kind, author, body, created_at)
     VALUES ($1, $2, 'message', $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [
      message.id,
      caseId,
      author,
      message.text,
      new Date(message.timestamp),
    ],
  );

  await dbQuery(
    `UPDATE cases SET last_activity_at = $1 WHERE id = $2`,
    [new Date(message.timestamp), caseId],
  );

  const result = await dbQuery(`SELECT * FROM artefacts WHERE id = $1`, [
    message.id,
  ]);
  return rowToArtefact(result.rows[0]);
}

export async function listArtefacts(
  caseId: string,
  after?: number,
): Promise<Artefact[]> {
  if (after) {
    const result = await dbQuery(
      `SELECT * FROM artefacts WHERE case_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [caseId, new Date(after)],
    );
    return result.rows.map(rowToArtefact);
  }
  const result = await dbQuery(
    `SELECT * FROM artefacts WHERE case_id = $1 ORDER BY created_at ASC`,
    [caseId],
  );
  return result.rows.map(rowToArtefact);
}

export async function getCaseWithArtefacts(caseId: string): Promise<{
  case: Case;
  artefacts: Artefact[];
} | null> {
  const c = await getCaseById(caseId);
  if (!c) return null;
  const artefacts = await listArtefacts(caseId);
  return { case: c, artefacts };
}

/**
 * Write a commitment from a locked vote.
 */
export async function writeCommitment(params: {
  caseId: string;
  investigatorFid: number;
  kind: CommitmentKind;
}): Promise<Commitment> {
  const id = `commit-${params.caseId}-${Date.now()}`;
  await dbQuery(
    `INSERT INTO commitments (id, case_id, investigator_fid, kind)
     VALUES ($1, $2, $3, $4)`,
    [id, params.caseId, params.investigatorFid, params.kind],
  );
  await dbQuery(
    `UPDATE cases SET state = 'committed', last_activity_at = NOW() WHERE id = $1`,
    [params.caseId],
  );
  const result = await dbQuery(`SELECT * FROM commitments WHERE id = $1`, [id]);
  return rowToCommitment(result.rows[0]);
}

/**
 * Convert artefacts back to ChatMessage[] for Match hydration.
 */
export function artefactsToMessages(
  artefacts: Artefact[],
  investigatorFid: number,
  personFid: number,
  investigatorUsername: string,
  personUsername: string,
): ChatMessage[] {
  return artefacts
    .filter((a) => a.kind === "message")
    .map((a) => {
      const isInvestigator = a.author === "investigator";
      return {
        id: a.id,
        sender: {
          fid: isInvestigator ? investigatorFid : personFid,
          username: isInvestigator ? investigatorUsername : personUsername,
        },
        text: a.body,
        timestamp: a.createdAt,
      };
    });
}

/**
 * Upsert investigator memory JSON mirror (Postgres).
 */
export async function saveInvestigatorMemory(
  investigatorFid: number,
  personFid: number,
  memory: Record<string, unknown>,
): Promise<void> {
  await dbQuery(
    `INSERT INTO investigator_memory (investigator_fid, person_fid, memory, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (investigator_fid, person_fid) DO UPDATE SET
       memory = EXCLUDED.memory,
       updated_at = NOW()`,
    [investigatorFid, personFid, JSON.stringify(memory)],
  );
}

export async function loadInvestigatorMemory(
  investigatorFid: number,
  personFid: number,
): Promise<Record<string, unknown> | null> {
  const result = await dbQuery(
    `SELECT memory FROM investigator_memory
     WHERE investigator_fid = $1 AND person_fid = $2`,
    [investigatorFid, personFid],
  );
  return result.rows[0]?.memory ?? null;
}
