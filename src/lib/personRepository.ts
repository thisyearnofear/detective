/**
 * Person Repository — durable cast-derived identities (Postgres SoT)
 *
 * PRINCIPLE: ENHANCEMENT FIRST — maps from Bot registration data
 * PRINCIPLE: DRY — single write path for persons + persona snapshots
 */

import { createHash } from "crypto";
import { dbQuery } from "./database";
import type { Bot, Person, PersonaSnapshot } from "./types";

function castsHash(casts: Array<{ text: string }>): string {
  const payload = casts.map((c) => c.text).join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function rowToPerson(row: any): Person {
  return {
    fid: row.fid,
    username: row.username,
    displayName: row.display_name,
    pfpUrl: row.pfp_url || "",
    source: (row.source || "farcaster") as "farcaster",
    createdAt: new Date(row.created_at).getTime(),
  };
}

function rowToSnapshot(row: any): PersonaSnapshot {
  return {
    id: row.id,
    personFid: row.person_fid,
    style: row.style || "",
    personality: row.personality ?? null,
    casts: Array.isArray(row.casts) ? row.casts : [],
    castsHash: row.casts_hash || "",
    capturedAt: new Date(row.captured_at).getTime(),
  };
}

/**
 * Upsert a Person from any UserProfile (REAL opponent without Bot training data).
 */
export async function upsertPersonFromProfile(
  profile: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  },
): Promise<Person> {
  await dbQuery(
    `INSERT INTO persons (fid, username, display_name, pfp_url, source)
     VALUES ($1, $2, $3, $4, 'farcaster')
     ON CONFLICT (fid) DO UPDATE SET
       username = EXCLUDED.username,
       display_name = EXCLUDED.display_name,
       pfp_url = EXCLUDED.pfp_url`,
    [profile.fid, profile.username, profile.displayName, profile.pfpUrl || ""],
  );
  const person = await getPersonByFid(profile.fid);
  if (!person) {
    throw new Error(`[personRepository] Failed to upsert person ${profile.fid}`);
  }
  return person;
}

/**
 * Upsert a Person from a Bot (or Bot-like profile).
 */
export async function upsertPersonFromBot(bot: Bot): Promise<Person> {
  await upsertPersonFromProfile(bot);

  const casts = (bot.recentCasts || []).map((c: any) => ({
    text: typeof c === "string" ? c : c.text || "",
    castHash: c.hash || c.castHash,
    timestamp: c.timestamp,
  }));
  const hash = castsHash(casts);

  // Skip duplicate snapshot if identical residue already stored
  const existing = await dbQuery<{ casts_hash: string }>(
    `SELECT casts_hash FROM persona_snapshots
     WHERE person_fid = $1
     ORDER BY captured_at DESC LIMIT 1`,
    [bot.fid],
  );
  if (existing.rows[0]?.casts_hash !== hash) {
    const snapshotId = `snap-${bot.fid}-${Date.now()}`;
    await dbQuery(
      `INSERT INTO persona_snapshots (id, person_fid, style, personality, casts, casts_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        snapshotId,
        bot.fid,
        bot.style || "",
        bot.personality ? JSON.stringify(bot.personality) : null,
        JSON.stringify(casts),
        hash,
      ],
    );
  }

  const person = await getPersonByFid(bot.fid);
  if (!person) {
    throw new Error(`[personRepository] Failed to upsert person ${bot.fid}`);
  }
  return person;
}

export async function getPersonByFid(fid: number): Promise<Person | null> {
  const result = await dbQuery(
    `SELECT * FROM persons WHERE fid = $1`,
    [fid],
  );
  return result.rows[0] ? rowToPerson(result.rows[0]) : null;
}

export async function getLatestPersonaSnapshot(
  personFid: number,
): Promise<PersonaSnapshot | null> {
  const result = await dbQuery(
    `SELECT * FROM persona_snapshots
     WHERE person_fid = $1
     ORDER BY captured_at DESC LIMIT 1`,
    [personFid],
  );
  return result.rows[0] ? rowToSnapshot(result.rows[0]) : null;
}

export async function listPersons(limit = 100): Promise<Person[]> {
  const result = await dbQuery(
    `SELECT * FROM persons ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(rowToPerson);
}

/**
 * Reconstruct a Bot runtime object from durable Person + latest snapshot.
 * Used when Redis bot map is cold.
 */
export async function personToBot(personFid: number): Promise<Bot | null> {
  const person = await getPersonByFid(personFid);
  if (!person) return null;

  const snapshot = await getLatestPersonaSnapshot(personFid);
  const profile = {
    fid: person.fid,
    username: person.username,
    displayName: person.displayName,
    pfpUrl: person.pfpUrl,
  };

  return {
    ...profile,
    type: "BOT",
    originalAuthor: profile,
    recentCasts: snapshot?.casts || [],
    style: snapshot?.style || "",
    personality: snapshot?.personality || undefined,
  };
}

/**
 * Load all persons that have at least one snapshot as Bots.
 */
export async function loadAllPersonsAsBots(): Promise<Map<number, Bot>> {
  const result = await dbQuery<{ fid: number }>(
    `SELECT DISTINCT p.fid FROM persons p
     INNER JOIN persona_snapshots s ON s.person_fid = p.fid`,
  );
  const bots = new Map<number, Bot>();
  for (const row of result.rows) {
    const bot = await personToBot(row.fid);
    if (bot) bots.set(bot.fid, bot);
  }
  return bots;
}

/**
 * Pick a random person (with persona snapshot) for a new investigation.
 */
export async function pickRandomPerson(excludeFid?: number): Promise<Person | null> {
  const result = await dbQuery(
    excludeFid
      ? `SELECT p.* FROM persons p
         INNER JOIN persona_snapshots s ON s.person_fid = p.fid
         WHERE p.fid <> $1
         ORDER BY RANDOM() LIMIT 1`
      : `SELECT p.* FROM persons p
         INNER JOIN persona_snapshots s ON s.person_fid = p.fid
         ORDER BY RANDOM() LIMIT 1`,
    excludeFid ? [excludeFid] : [],
  );
  return result.rows[0] ? rowToPerson(result.rows[0]) : null;
}
