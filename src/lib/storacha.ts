// src/lib/storacha.ts
// Storacha decentralized storage integration for Detective
// Stores bot training data, match history, and verifiable game provenance on IPFS/Filecoin
//
// SETUP:
// 1. npm install -g @storacha/cli
// 2. storacha login your@email.com
// 3. storacha space create detective-game
// 4. storacha space info  (get your Space DID)
// 5. Export delegation for server use (see docs.storacha.network/how-to/upload)

import type { Client } from "@storacha/client";

const STORACHA_ENABLED = process.env.STORACHA_ENABLED === "true";
const STORACHA_GATEWAY = "https://storacha.link/ipfs";

let clientInstance: Client | null = null;

/**
 * Get or create the Storacha client.
 * Uses default agent store from CLI auth (storacha login).
 */
async function getClient(): Promise<Client> {
  if (clientInstance) return clientInstance;

  if (!STORACHA_ENABLED) {
    throw new Error("[Storacha] Disabled. Set STORACHA_ENABLED=true.");
  }

  const { create } = await import("@storacha/client");
  clientInstance = await create();

  const spaceDid = process.env.STORACHA_SPACE_DID;
  if (spaceDid) {
    await clientInstance.setCurrentSpace(spaceDid as `did:${string}:${string}`);
  }

  return clientInstance;
}

// ============================================================
// DATA TYPES
// ============================================================

export interface BotTrainingData {
  botUsername: string;
  originalAuthor: string;
  castCount: number;
  casts: Array<{ text: string; timestamp?: string }>;
  writingStyle: string;
  personality: Record<string, unknown>;
  capturedAt: string;
  gameId: string;
}

export interface MatchProvenance {
  matchId: string;
  gameId: string;
  roundNumber: number;
  playerUsername: string;
  opponentUsername: string;
  opponentType: "REAL" | "BOT";
  llmModel?: string;
  llmProvider?: string;
  playerVote: "REAL" | "BOT" | null;
  correctAnswer: "REAL" | "BOT";
  wasCorrect: boolean;
  voteSpeedMs: number;
  messageCount: number;
  startedAt: string;
  endedAt: string;
}

export interface GameSnapshot {
  gameId: string;
  cycleNumber: number;
  playerCount: number;
  botCount: number;
  matchCount: number;
  startedAt: string;
  endedAt: string;
  leaderboard: Array<{
    username: string;
    accuracy: number;
    totalVotes: number;
    correctVotes: number;
  }>;
  llmModelsUsed: string[];
}

// ============================================================
// UPLOAD FUNCTIONS
// ============================================================

/**
 * Upload bot training data (cast history + personality) to Storacha.
 * Returns IPFS CID for verifiable provenance.
 */
export async function uploadBotTrainingData(
  data: BotTrainingData
): Promise<{ cid: string; gatewayUrl: string } | null> {
  if (!STORACHA_ENABLED) return null;

  try {
    const client = await getClient();
    const json = JSON.stringify(data, null, 2);
    const file = new File(
      [json],
      `bot-training-${data.botUsername}-${data.gameId}.json`,
      { type: "application/json" }
    );

    const cid = await client.uploadFile(file);
    const url = `${STORACHA_GATEWAY}/${cid}`;
    console.log(`[Storacha] Bot training data uploaded: ${data.botUsername} → ${url}`);
    return { cid: String(cid), gatewayUrl: url };
  } catch (error) {
    console.error("[Storacha] Upload failed:", error);
    return null;
  }
}

/**
 * Upload match provenance (immutable record of each match) to Storacha.
 */
export async function uploadMatchProvenance(
  data: MatchProvenance
): Promise<{ cid: string; gatewayUrl: string } | null> {
  if (!STORACHA_ENABLED) return null;

  try {
    const client = await getClient();
    const json = JSON.stringify(data, null, 2);
    const file = new File([json], `match-${data.matchId}.json`, {
      type: "application/json",
    });

    const cid = await client.uploadFile(file);
    const url = `${STORACHA_GATEWAY}/${cid}`;
    console.log(`[Storacha] Match provenance uploaded: ${data.matchId} → ${url}`);
    return { cid: String(cid), gatewayUrl: url };
  } catch (error) {
    console.error("[Storacha] Upload failed:", error);
    return null;
  }
}

/**
 * Upload full game snapshot (leaderboard + metadata) as a directory to Storacha.
 */
export async function uploadGameSnapshot(
  data: GameSnapshot
): Promise<{ cid: string; gatewayUrl: string } | null> {
  if (!STORACHA_ENABLED) return null;

  try {
    const client = await getClient();

    const leaderboardFile = new File(
      [JSON.stringify(data.leaderboard, null, 2)],
      "leaderboard.json",
      { type: "application/json" }
    );

    const metadataFile = new File(
      [
        JSON.stringify(
          {
            gameId: data.gameId,
            cycleNumber: data.cycleNumber,
            playerCount: data.playerCount,
            botCount: data.botCount,
            matchCount: data.matchCount,
            startedAt: data.startedAt,
            endedAt: data.endedAt,
            llmModelsUsed: data.llmModelsUsed,
          },
          null,
          2
        ),
      ],
      "metadata.json",
      { type: "application/json" }
    );

    const cid = await client.uploadDirectory([leaderboardFile, metadataFile]);
    const url = `${STORACHA_GATEWAY}/${cid}`;
    console.log(`[Storacha] Game snapshot uploaded: ${data.gameId} → ${url}`);
    return { cid: String(cid), gatewayUrl: url };
  } catch (error) {
    console.error("[Storacha] Upload failed:", error);
    return null;
  }
}

/**
 * Batch upload match provenances as a single directory for efficiency.
 */
export async function uploadMatchProvenances(
  matches: MatchProvenance[]
): Promise<Array<{ matchId: string; cid: string; gatewayUrl: string }>> {
  if (!STORACHA_ENABLED || matches.length === 0) return [];

  try {
    const client = await getClient();
    const files = matches.map(
      (m) =>
        new File(
          [JSON.stringify(m, null, 2)],
          `match-${m.matchId}.json`,
          { type: "application/json" }
        )
    );

    const cid = await client.uploadDirectory(files);
    const url = `${STORACHA_GATEWAY}/${cid}`;
    console.log(
      `[Storacha] Batch uploaded ${matches.length} match provenances → ${url}`
    );
    return matches.map((m) => ({
      matchId: m.matchId,
      cid: String(cid),
      gatewayUrl: url,
    }));
  } catch (error) {
    console.error("[Storacha] Batch upload failed:", error);
    return [];
  }
}

// ============================================================
// VERIFICATION
// ============================================================

/**
 * Verify data exists at a CID on IPFS/Storacha.
 */
export async function verifyStoredData(cid: string): Promise<{
  exists: boolean;
  url: string;
  data?: unknown;
}> {
  const url = `${STORACHA_GATEWAY}/${cid}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { exists: true, url, data };
    }
    return { exists: false, url };
  } catch {
    return { exists: false, url };
  }
}

export function isStorachaEnabled(): boolean {
  return STORACHA_ENABLED;
}
