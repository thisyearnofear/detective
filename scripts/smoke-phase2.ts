import { db, dbQuery } from "../src/lib/database.ts";
import * as personRepo from "../src/lib/personRepository.ts";
import * as caseRepo from "../src/lib/caseRepository.ts";
import {
  scheduleOfflineFollowUp,
  listUnseenFollowUps,
  getReturnRateMetric,
  markArtefactSeen,
  offlineDelayMs,
} from "../src/lib/offlineEvents.ts";

await db.initialize?.();

const investigator = 999020;
const personFid = 999021;

process.env.OFFLINE_EVENT_MIN_MS = "1000";
process.env.OFFLINE_EVENT_MAX_MS = "2000";
console.log("delayMs", offlineDelayMs());

const bot = {
  fid: personFid,
  username: "offline_subject2",
  displayName: "Offline Subject2",
  pfpUrl: "",
  type: "BOT" as const,
  originalAuthor: {
    fid: personFid,
    username: "offline_subject2",
    displayName: "Offline Subject2",
    pfpUrl: "",
  },
  recentCasts: [{ text: "still around if you need anything" }],
  style: "casual",
  personality: { communicationStyle: "terse" as const },
};

await personRepo.upsertPersonFromBot(bot as any);
await personRepo.upsertPersonFromProfile({
  fid: investigator,
  username: "inv2",
  displayName: "Inv2",
  pfpUrl: "",
});

const match = {
  id: "match-oe-2",
  player: {
    fid: investigator,
    username: "inv2",
    displayName: "Inv2",
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
    id: `msg-oe-${Date.now()}`,
    sender: { fid: investigator, username: "inv2" },
    text: "you still there?",
    timestamp: Date.now(),
  },
  investigatorFid: investigator,
  personFid,
});

const ev = await scheduleOfflineFollowUp(c.id);
console.log("scheduled", !!ev, ev?.id);

const artefactId = `art-offline-test-${Date.now()}`;
await dbQuery(
  `INSERT INTO artefacts (id, case_id, kind, author, body, created_at)
   VALUES ($1, $2, 'offline_follow_up', 'person', $3, NOW())`,
  [artefactId, c.id, "yeah — couldn't sleep. keep digging."],
);
await dbQuery(
  `UPDATE offline_events
   SET status = 'delivered', payload_artefact_id = $2, delivered_at = NOW(),
       scheduled_for = NOW() - interval '1 minute'
   WHERE case_id = $1 AND status = 'pending'`,
  [c.id, artefactId],
);

const unseen = await listUnseenFollowUps(investigator);
console.log("unseen", unseen.length, unseen[0]?.body);

await markArtefactSeen(artefactId);
const unseenAfter = await listUnseenFollowUps(investigator);
console.log("unseenAfter", unseenAfter.length);

const metric = await getReturnRateMetric();
console.log("metric", metric);
console.log(
  ev && unseen.length === 1 && unseenAfter.length === 0
    ? "PHASE2_SMOKE_OK"
    : "PHASE2_SMOKE_FAIL",
);
