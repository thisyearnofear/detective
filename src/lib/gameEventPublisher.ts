/**
 * Game Event Publisher
 * 
 * Publishes game state changes via Ably to keep clients in sync.
 * Eliminates the need for HTTP polling of match state.
 * 
 * Events published:
 * - round_start: New round begins with fresh matches
 * - round_end: Round completed, matches revealed
 * - match_start: Individual match starts
 * - match_end: Individual match ends (vote locked)
 * - game_start: Game transitions from REGISTRATION to LIVE
 * - game_end: Game transitions to FINISHED
 * - vote_locked: A specific match vote is finalized
 * - state_update: General game state change (round number, timer, etc.)
 */

import { getAblyServerManager } from "./ablyChannelManager";
import type { Match } from "./types";

class GameEventPublisher {
  private static instance: GameEventPublisher;
  private ablySrv = getAblyServerManager();

  private constructor() {}

  static getInstance(): GameEventPublisher {
    if (!GameEventPublisher.instance) {
      GameEventPublisher.instance = new GameEventPublisher();
    }
    return GameEventPublisher.instance;
  }

  /**
   * Publish when a new round starts
   */
  async publishRoundStart(
    cycleId: string,
    roundNumber: number,
    matchIds: string[],
    targetFids?: number[]
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "round_start",
        {
          roundNumber,
          matchIds,
          timestamp: Date.now(),
        },
        targetFids
      );
      console.log(`[GameEventPublisher] Published round_start for round ${roundNumber}`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing round_start:", err);
    }
  }

  /**
   * Publish when a round ends and matches are revealed
   */
  async publishRoundEnd(
    cycleId: string,
    roundNumber: number,
    matches: { matchId: string; correct: boolean }[],
    targetFids?: number[]
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "round_end",
        {
          roundNumber,
          matches,
          timestamp: Date.now(),
        },
        targetFids
      );
      console.log(`[GameEventPublisher] Published round_end for round ${roundNumber}`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing round_end:", err);
    }
  }

  /**
   * Publish when a match starts
   */
  async publishMatchStart(
    cycleId: string,
    match: Match
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "match_start",
        {
          matchId: match.id,
          slotNumber: match.slotNumber,
          roundNumber: match.roundNumber,
          opponentFid: match.opponent.fid,
          opponentUsername: match.opponent.username,
          startTime: match.startTime,
          endTime: match.endTime,
          timestamp: Date.now(),
        },
        [match.player.fid] // Only for the player in this match
      );
      console.log(`[GameEventPublisher] Published match_start for ${match.id}`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing match_start:", err);
    }
  }

  /**
   * Publish when a match ends (vote locked)
   */
  async publishMatchEnd(
    cycleId: string,
    match: Match,
    isCorrect: boolean,
    actualOpponentType: "REAL" | "BOT"
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "match_end",
        {
          matchId: match.id,
          slotNumber: match.slotNumber,
          roundNumber: match.roundNumber,
          playerVote: match.currentVote || "REAL",
          isCorrect,
          actualOpponentType,
          opponentFid: match.opponent.fid,
          timestamp: Date.now(),
        },
        [match.player.fid]
      );
      console.log(`[GameEventPublisher] Published match_end for ${match.id}`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing match_end:", err);
    }
  }

  /**
   * Publish when a specific vote is locked
   */
  async publishVoteLocked(
    cycleId: string,
    matchId: string,
    playerFid: number,
    vote: string,
    isCorrect: boolean
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "vote_locked",
        {
          matchId,
          playerFid,
          vote,
          isCorrect,
          timestamp: Date.now(),
        },
        [playerFid]
      );
      console.log(`[GameEventPublisher] Published vote_locked for match ${matchId}`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing vote_locked:", err);
    }
  }

  /**
   * Publish when game transitions to LIVE
   */
  async publishGameStart(
    cycleId: string,
    targetFids: number[]
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "game_start",
        {
          timestamp: Date.now(),
        },
        targetFids
      );
      console.log(`[GameEventPublisher] Published game_start to ${targetFids.length} players`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing game_start:", err);
    }
  }

  /**
   * Publish when game transitions to FINISHED
   */
  async publishGameEnd(
    cycleId: string,
    leaderboard: Array<{ fid: number; score: number }>,
    targetFids: number[]
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "game_end",
        {
          leaderboard,
          timestamp: Date.now(),
        },
        targetFids
      );
      console.log(`[GameEventPublisher] Published game_end to ${targetFids.length} players`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing game_end:", err);
    }
  }

  /**
   * Publish when a new chat message is added to a match
   */
  async publishChatMessage(
    cycleId: string,
    matchId: string,
    playerFid: number,
    senderFid: number,
    text: string
  ): Promise<void> {
    try {
      await this.ablySrv.publishGameEvent(
        cycleId,
        "chat_message",
        {
          matchId,
          senderFid,
          text,
          timestamp: Date.now(),
        },
        [playerFid] // Only for the player in this match
      );
      console.log(`[GameEventPublisher] Published chat_message for match ${matchId} from FID ${senderFid}`);
    } catch (err) {
      console.error("[GameEventPublisher] Error publishing chat_message:", err);
    }
  }
}

export function getGameEventPublisher(): GameEventPublisher {
  return GameEventPublisher.getInstance();
}

export default getGameEventPublisher();
