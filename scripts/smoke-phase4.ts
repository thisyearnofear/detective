/**
 * Phase 4.1 smoke: follow_up → deliver → echo scheduled → both kinds in inbox.
 * Uses short delays via env for local runs.
 */
import { db, dbQuery } from "../src/lib/database.ts";
import * as personRepo from "../src/lib/personRepository.ts";
import * as caseRepo from "../src/lib/caseRepository.ts";
import {
  scheduleOfflineFollowUp,
  maybeScheduleOfflineEcho,
  listUnseenFollowUps,
  markArtefactSeen,
  offlineDelayMs,
  offlineEchoDelayMs,
} from "../src/lib/offlineEvents.ts";

process.env.OFFLINE_EVENT_MIN_MS = "500";
process.env.OFFLINE_EVENT_MAX_MS = "800";
process.env.OFFLINE_ECHO_MIN_MS = "900";
process.env.OFFLINE_ECHO_MAX_MS = "1200";

await db.initialize?.();

const investigator = 999040;
const personFid = 999041;

console.log("followUpDelay", offlineDelayMs(), "echoDelay", offlineEchoDelayMs());

const bot = {
  fid: personFid,
  username: "echo_subject",
  displayName: "Echo Subject",
  pfpUrl: "",
  type: "BOT" as const,
  originalAuthor: {
    fid: personFid,
    username: "echo_subject",
    displayName: "Echo Subject",
    pfpUrl: "",
  },
  recentCasts: [{ text: "half-finished thoughts at 3am" }],
  style: "casual",
  personality: { communicationStyle: "terse" as const },
};

await personRepo.upsertPersonFromBot(bot as any);
await personRepo.upsertPersonFromProfile({
  fid: investigator,
  username: "inv4",
  displayName: "Inv4",
  pfpUrl: "",
});

const match = {
  id: "match-oe-4",
  player: {
    fid: investigator,
    username: "inv4",
    displayName: "Inv4",
    pfpUrl: "",
    type: "REAL" as const,
    isRegistered: true,
    isReady: true,
    score: 0,
    voteHistory: [],
    inactivityStrikes: 0,
    lastActiveTime: Date.now(),
  },
  opponent: bot as any,
  startTime: Date.now(),
  endTime: Date.now() + 60000,
  messages: [],
  isVotingComplete: false,
  isFinished: false,
  slotNumber: 1 as const,
  roundNumber: 1,
  voteHistory: [],
  voteLocked: false,
  lastPlayerMessageTime: Date.now(),
};

const c = await caseRepo.upsertCaseFromMatch(match as any);
await caseRepo.appendMessageArtefact({
  caseId: c.id,
  message: {
    id: `msg-oe4-${Date.now()}`,
    sender: { fid: investigator, username: "inv4" },
    text: "what were you thinking about earlier?",
    timestamp: Date.now(),
  },
  investigatorFid: investigator,
  personFid,
});

// Clean prior smoke events for this case
await dbQuery(`DELETE FROM offline_events WHERE case_id = $1`, [c.id]);
await dbQuery(
  `DELETE FROM artefacts WHERE case_id = $1 AND kind IN ('offline_follow_up','offline_echo')`,
  [c.id],
);

const followUp = await scheduleOfflineFollowUp(c.id);
console.log("follow_up scheduled", !!followUp, followUp?.kind);

const art1 = `art-offline-test-fu-${Date.now()}`;
await dbQuery(
  `INSERT INTO artefacts (id, case_id, kind, author, body, created_at)
   VALUES ($1, $2, 'offline_follow_up', 'person', $3, NOW())`,
  [art1, c.id, "was thinking about what you asked."],
);
await dbQuery(
  `UPDATE offline_events
   SET status = 'delivered', payload_artefact_id = $2, delivered_at = NOW()
   WHERE id = $1`,
  [followUp!.id, art1],
);

const echo = await maybeScheduleOfflineEcho(c.id, "follow_up");
console.log("echo scheduled", !!echo, echo?.kind, echo?.id);

const duplicateEcho = await maybeScheduleOfflineEcho(c.id, "follow_up");
console.log("duplicate echo blocked", duplicateEcho === null);

const art2 = `art-offline-test-echo-${Date.now()}`;
await dbQuery(
  `INSERT INTO artefacts (id, case_id, kind, author, body, created_at)
   VALUES ($1, $2, 'offline_echo', 'person', $3, NOW())`,
  [art2, c.id, "also — that thing you said earlier. still sitting with it."],
);
await dbQuery(
  `UPDATE offline_events
   SET status = 'delivered', payload_artefact_id = $2, delivered_at = NOW()
   WHERE id = $1`,
  [echo!.id, art2],
);

const unseen = await listUnseenFollowUps(investigator);
console.log(
  "unseen",
  unseen.length,
  unseen.map((u) => u.kind),
);

await markArtefactSeen(art1);
await markArtefactSeen(art2);
const unseenAfter = await listUnseenFollowUps(investigator);

const ok =
  !!followUp &&
  followUp.kind === "follow_up" &&
  !!echo &&
  echo.kind === "echo" &&
  duplicateEcho === null &&
  unseen.length === 2 &&
  unseenAfter.length === 0;

console.log(ok ? "PHASE4_SMOKE_OK" : "PHASE4_SMOKE_FAIL");
process.exit(ok ? 0 : 1);
