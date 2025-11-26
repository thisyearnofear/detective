// src/lib/gameState.ts
/**
 * Game State Manager - Single Source of Truth
 * 
 * Unified async interface for all game operations.
 * Works with both Redis (production) and in-memory (development).
 * 
 * Core Principles:
 * - All methods are async (Promise-based)
 * - Single initialization pattern
 * - Clear state lifecycle management
 */

import {
  GameState,
  Player,
  Bot,
  Match,
  LeaderboardEntry,
  UserProfile,
  PlayerGameSession,
  VoteRecord,
  ChatMessage,
} from "./types";
import * as persistence from "./gamePersistence";
import { database } from "./database";
import { getGameEventPublisher } from "./gameEventPublisher";
import { inferPersonality } from "./botProactive";

// Game configuration constants
const GAME_DURATION = 3 * 60 * 1000; // 3 minutes (3 rounds * 1 min each, 2 simultaneous matches per round)
const REGISTRATION_COUNTDOWN = 30 * 1000; // 30 second countdown once minimum players join
const MIN_PLAYERS = 3; // Minimum players needed for a competitive game
const MAX_PLAYERS = 50;
const MATCH_DURATION = 60 * 1000; // 1 minute per match
const SIMULTANEOUS_MATCHES = 2; // 2 concurrent chats
const INACTIVITY_WARNING = 30 * 1000; // 30 seconds
const INACTIVITY_FORFEIT = 45 * 1000; // 45 seconds
const FIXED_ROUNDS = 3; // Fixed 3 rounds for predictable experience (6 total matches)
const MAX_ROUNDS = FIXED_ROUNDS; // Use fixed rounds
const USE_REDIS = process.env.USE_REDIS === "true";

/**
 * Manages the complete game state.
 * Singleton pattern with lazy initialization.
 */
class GameManager {
  private static instance: GameManager;
  private state: GameState | null = null;
  private initializing = false;

  private constructor() { }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * Initialize or retrieve current game state.
   * Loads from Redis on first call if available.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.state) return;
    if (this.initializing) {
      // Wait for initialization to complete
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;
    try {
      // Try loading from Redis first
      const stateMeta = await persistence.loadGameStateMeta();

      if (stateMeta) {
        // Load existing cycle from Redis
        const players = await persistence.loadAllPlayers();
        const bots = await persistence.loadAllBots();
        const matches = await persistence.loadAllMatches();
        const sessions = await persistence.loadAllSessions();

        this.state = {
          cycleId: stateMeta.cycleId,
          state: stateMeta.state,
          registrationEnds: stateMeta.registrationEnds,
          gameEnds: stateMeta.gameEnds,
          players,
          bots,
          matches,
          playerSessions: sessions,
          leaderboard: [],
          extensionCount: 0,
          maxExtensions: 2,
          countdownStarted: false, // Will be set when minimum players join
          config: {
            gameDurationMs: GAME_DURATION,
            matchDurationMs: MATCH_DURATION,
            simultaneousMatches: SIMULTANEOUS_MATCHES,
            inactivityWarningMs: INACTIVITY_WARNING,
            inactivityForfeitMs: INACTIVITY_FORFEIT,
            maxInactivityStrikes: 3,
          },
        };
        console.log(`[GameManager] Loaded cycle ${stateMeta.cycleId} from Redis`);
      } else {
        // Create new cycle
        this.state = this.createNewGameState();
        await persistence.saveGameStateMeta({
          cycleId: this.state.cycleId,
          state: this.state.state,
          registrationEnds: this.state.registrationEnds,
          gameEnds: this.state.gameEnds,
        });
        console.log(`[GameManager] Created new cycle ${this.state.cycleId}`);
      }
    } finally {
      this.initializing = false;
    }
  }

  private createNewGameState(): GameState {
    const now = Date.now();
    return {
      cycleId: `cycle-${now}`,
      state: "REGISTRATION",
      registrationEnds: now + 999999999, // Far future - countdown starts when MIN_PLAYERS join
      gameEnds: now + GAME_DURATION,
      players: new Map(),
      bots: new Map(),
      matches: new Map(),
      playerSessions: new Map(),
      leaderboard: [],
      extensionCount: 0,
      maxExtensions: 2,
      countdownStarted: false, // Will be set to true when MIN_PLAYERS join
      config: {
        gameDurationMs: GAME_DURATION,
        matchDurationMs: MATCH_DURATION,
        simultaneousMatches: SIMULTANEOUS_MATCHES,
        inactivityWarningMs: INACTIVITY_WARNING,
        inactivityForfeitMs: INACTIVITY_FORFEIT,
        maxInactivityStrikes: 3,
      },
    };
  }

  /**
   * Get the current game state, updating cycle state as needed.
   */
  async getGameState() {
    await this.ensureInitialized();
    await this.updateCycleState();
    await this.cleanupOldMatches();

    return {
      cycleId: this.state!.cycleId,
      state: this.state!.state,
      registrationEnds: this.state!.registrationEnds,
      gameEnds: this.state!.gameEnds,
      playerCount: this.state!.players.size,
      config: this.state!.config,
      isRegistered: false, // Will be set by routes if needed
    };
  }

  /**
   * Register a player and create their bot counterpart.
   */
  async registerPlayer(
    userProfile: UserProfile,
    recentCasts: { text: string }[],
    style: string,
  ): Promise<Player | null> {
    await this.ensureInitialized();

    if (this.state!.players.size >= MAX_PLAYERS) {
      console.warn("[registerPlayer] Max players reached");
      return null;
    }

    if (this.state!.players.has(userProfile.fid)) {
      return this.state!.players.get(userProfile.fid)!;
    }

    // Create player
    const player: Player = {
      ...userProfile,
      type: "REAL",
      isRegistered: true,
      isReady: false,
      score: 0,
      voteHistory: [],
      inactivityStrikes: 0,
      lastActiveTime: Date.now(),
    };

    // Create bot
    const bot: Bot = {
      ...userProfile,
      type: "BOT",
      originalAuthor: userProfile,
      recentCasts,
      style,
      personality: inferPersonality({
        ...userProfile,
        type: "BOT",
        originalAuthor: userProfile,
        recentCasts,
        style,
      } as Bot),
    };

    this.state!.players.set(userProfile.fid, player);
    this.state!.bots.set(userProfile.fid, bot);

    // Persist
    await persistence.savePlayer(player);
    await persistence.saveBot(bot);

    return player;
  }

  /**
   * Set player as ready and check if game should start.
   */
  async setPlayerReady(fid: number): Promise<boolean> {
    await this.ensureInitialized();

    const player = this.state!.players.get(fid);
    if (!player) return false;

    player.isReady = true;
    await persistence.savePlayer(player);

    // Check if we should start the game early
    const players = Array.from(this.state!.players.values());
    const readyCount = players.filter(p => p.isReady).length;
    const totalPlayers = players.length;

    // Start if minimum players met and all are ready
    if (totalPlayers >= MIN_PLAYERS && readyCount === totalPlayers) {
      console.log(`[GameManager] All ${totalPlayers} players ready, starting game immediately`);

      // Transition to LIVE immediately
      const now = Date.now();
      this.state!.state = "LIVE";
      this.state!.registrationEnds = now - 1;
      this.state!.gameEnds = now + GAME_DURATION;
      this.state!.extensionCount = 0;

      await persistence.saveGameStateMeta({
        cycleId: this.state!.cycleId,
        state: this.state!.state,
        registrationEnds: this.state!.registrationEnds,
        gameEnds: this.state!.gameEnds,
      });

      const playerFids = Array.from(this.state!.players.keys());
      getGameEventPublisher()
        .publishGameStart(this.state!.cycleId, playerFids)
        .catch(err => console.error("[setPlayerReady] Failed to publish game_start:", err));

      return true;
    }

    return false;
  }

  /**
   * Get active matches for a player, creating new ones as needed.
   */
  async getActiveMatches(fid: number): Promise<Match[]> {
    await this.ensureInitialized();

    const player = this.state!.players.get(fid);
    if (!player || this.state!.state !== "LIVE") {
      return [];
    }

    const session = this.getOrCreateSession(fid);
    const now = Date.now();
    const matches: Match[] = [];

    // Use fixed rounds for predictable experience
    const maxRounds = FIXED_ROUNDS;

    if (session.currentRound > maxRounds) {
      return [];
    }

    // Check existing matches - add grace period to prevent premature endings
    let activeMatchCount = 0;
    let hasExpiredMatches = false;
    const MATCH_END_GRACE_PERIOD = 2000; // 2 second grace period to prevent premature endings

    for (const [slotNum, matchId] of session.activeMatches) {
      const match = this.state!.matches.get(matchId);
      if (!match) {
        session.activeMatches.delete(slotNum);
        hasExpiredMatches = true;
      } else if ((match.endTime + MATCH_END_GRACE_PERIOD) <= now && !match.voteLocked) {
        // Auto-lock expired match (with grace period)
        this.lockMatchVote(matchId);
        hasExpiredMatches = true;
      } else if ((match.endTime + MATCH_END_GRACE_PERIOD) <= now && match.voteLocked) {
        // Already locked (with grace period)
        hasExpiredMatches = true;
        session.activeMatches.delete(slotNum);
      } else {
        // Still active (including grace period)
        matches.push(match);
        activeMatchCount++;
      }
    }

    // Round progression logic
    const ROUND_TRANSITION_GRACE_PERIOD = 3000; // 3 seconds after matches end
    const isRoundComplete = activeMatchCount === 0 && session.activeMatches.size === 0 && hasExpiredMatches;
    const isTimeForNextRound = !session.nextRoundStartTime || (now >= (session.nextRoundStartTime + ROUND_TRANSITION_GRACE_PERIOD));

    if (!session.nextRoundStartTime && activeMatchCount === 0) {
      // Start round 1
      session.currentRound = 1;
      session.nextRoundStartTime = now + MATCH_DURATION;

      for (let slotNum = 1; slotNum <= SIMULTANEOUS_MATCHES; slotNum++) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session);
        if (match) {
          session.activeMatches.set(slotNum, match.id);
          matches.push(match);
        }
      }
    } else if (isRoundComplete && session.currentRound < maxRounds && isTimeForNextRound) {
      // Advance to next round
      console.log(`[GameManager] Advancing FID ${fid} from round ${session.currentRound} to ${session.currentRound + 1}`);
      session.currentRound++;
      session.nextRoundStartTime = now + MATCH_DURATION;
      session.activeMatches.clear();

      for (let slotNum = 1; slotNum <= SIMULTANEOUS_MATCHES; slotNum++) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session);
        if (match) {
          session.activeMatches.set(slotNum, match.id);
          matches.push(match);
        }
      }
    } else if (isRoundComplete && session.currentRound === maxRounds && isTimeForNextRound) {
      // Last round complete
      session.currentRound++;
      session.activeMatches.clear();
    }

    await persistence.saveSession(session);
    return matches;
  }

  /**
   * Add a message to a match.
   */
  async addMessageToMatch(
    matchId: string,
    text: string,
    senderFid: number,
  ): Promise<ChatMessage | null> {
    await this.ensureInitialized();

    const match = this.state!.matches.get(matchId);
    const sender = this.state!.players.get(senderFid) || this.state!.bots.get(senderFid);

    if (!match || !sender) return null;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: { fid: sender.fid, username: sender.username },
      text,
      timestamp: Date.now(),
    };

    match.messages.push(message);
    await persistence.saveMatch(match);

    return message;
  }

  /**
   * Update vote for a match (multiple times allowed).
   */
  async updateMatchVote(matchId: string, vote: "REAL" | "BOT"): Promise<Match | null> {
    await this.ensureInitialized();

    const match = this.state!.matches.get(matchId);
    if (!match || match.voteLocked) return null;

    match.currentVote = vote;
    match.voteHistory.push({ vote, timestamp: Date.now() });

    // Only auto-lock if significantly past end time (with grace period)
    const VOTE_LOCK_GRACE_PERIOD = 3000; // 3 second grace period
    if (Date.now() >= (match.endTime + VOTE_LOCK_GRACE_PERIOD)) {
      this.lockMatchVote(matchId);
    }

    await persistence.saveMatch(match);
    return match;
  }

  /**
   * Lock vote for a match and record result.
   */
  async lockMatchVote(matchId: string): Promise<boolean | null> {
    await this.ensureInitialized();

    const match = this.state!.matches.get(matchId);
    if (!match || match.voteLocked) return null;

    match.voteLocked = true;
    match.isVotingComplete = true;
    match.isFinished = true;

    const player = match.player;
    const guess = match.currentVote || "REAL";
    const actualType = match.opponent.type;
    const isCorrect = guess === actualType;

    const voteSpeed = match.currentVote
      ? match.voteHistory[match.voteHistory.length - 1].timestamp - match.startTime
      : match.endTime - match.startTime;

    const voteRecord: VoteRecord = {
      matchId,
      correct: isCorrect,
      speed: voteSpeed,
      voteChanges: match.voteHistory.length,
      opponentUsername: match.opponent.username,
      opponentType: match.opponent.type,
      roundNumber: match.roundNumber,
    };

    player.voteHistory.push(voteRecord);

    const session = this.state!.playerSessions.get(player.fid);
    if (session) {
      session.completedMatchIds.add(matchId);
      for (const [slot, id] of session.activeMatches) {
        if (id === matchId) {
          session.activeMatches.delete(slot);
          break;
        }
      }
      await persistence.saveSession(session);
    }

    await persistence.saveMatch(match);
    await persistence.savePlayer(player);

    // Save to database (async, non-blocking)
    this.saveMatchToDatabase(match, isCorrect, voteSpeed).catch(console.error);

    // Publish event (async, non-blocking)
    getGameEventPublisher()
      .publishMatchEnd(this.state!.cycleId, match, isCorrect, actualType)
      .catch(err => console.error("[lockMatchVote] Failed to publish event:", err));

    return isCorrect;
  }

  /**
   * Get leaderboard.
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.ensureInitialized();

    const leaderboard: LeaderboardEntry[] = Array.from(this.state!.players.values()).map(player => {
      const correctVotes = player.voteHistory.filter(v => v.correct && !v.forfeit);
      const accuracy = player.voteHistory.length > 0
        ? (correctVotes.length / player.voteHistory.length) * 100
        : 0;
      const avgSpeed = correctVotes.length > 0
        ? correctVotes.reduce((sum, v) => sum + v.speed, 0) / correctVotes.length
        : 0;

      return {
        player: {
          fid: player.fid,
          username: player.username,
          displayName: player.displayName,
          pfpUrl: player.pfpUrl,
        },
        accuracy,
        avgSpeed,
      };
    });

    leaderboard.sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.avgSpeed - b.avgSpeed;
    });

    return leaderboard;
  }

  /**
   * Get a specific match.
   */
  async getMatch(matchId: string): Promise<Match | null> {
    await this.ensureInitialized();

    let match = this.state!.matches.get(matchId);
    if (!match && USE_REDIS) {
      const loaded = await persistence.loadMatch(matchId);
      if (loaded) {
        match = loaded;
        this.state!.matches.set(matchId, match);
      }
    }

    return match ?? null;
  }

  /**
   * Get all matches (admin only).
   */
  async getAllMatches(): Promise<Match[]> {
    await this.ensureInitialized();
    return Array.from(this.state!.matches.values());
  }

  /**
   * Get all players (admin only).
   */
  async getAllPlayers(): Promise<Player[]> {
    await this.ensureInitialized();
    return Array.from(this.state!.players.values());
  }

  /**
   * Get all bots.
   */
  async getAllBots(): Promise<Bot[]> {
    await this.ensureInitialized();
    return Array.from(this.state!.bots.values());
  }

  /**
   * Get game config.
   */
  async getConfig() {
    await this.ensureInitialized();
    return this.state!.config;
  }

  /**
   * Get full state (for routes that need raw access).
   */
  async getRawState() {
    await this.ensureInitialized();
    return this.state!;
  }

  /**
   * Check if player is registered.
   */
  async isPlayerRegistered(fid: number): Promise<boolean> {
    await this.ensureInitialized();
    return this.state!.players.has(fid);
  }

  /**
   * Force state transition (admin/testing only).
   */
  async forceStateTransition(newState: "REGISTRATION" | "LIVE" | "FINISHED"): Promise<void> {
    await this.ensureInitialized();

    const now = Date.now();
    this.state!.state = newState;

    if (newState === "REGISTRATION") {
      this.state!.registrationEnds = now + REGISTRATION_DURATION;
      this.state!.gameEnds = now + GAME_DURATION;
      this.state!.extensionCount = 0;
    } else if (newState === "LIVE") {
      this.state!.registrationEnds = now - 1;
      this.state!.gameEnds = now + GAME_DURATION;
      this.state!.extensionCount = 0;
    } else if (newState === "FINISHED") {
      this.state!.leaderboard = await this.getLeaderboard();
    }

    await persistence.saveGameStateMeta({
      cycleId: this.state!.cycleId,
      state: this.state!.state,
      registrationEnds: this.state!.registrationEnds,
      gameEnds: this.state!.gameEnds,
    });
  }

  /**
   * Reset the entire game (admin/testing only).
   */
  async resetGame(): Promise<void> {
    await persistence.clearAll();
    this.state = null;
    this.initializing = false;
    console.log("[GameManager] Game reset complete");
  }

  // ========== PRIVATE HELPERS ==========

  private getOrCreateSession(fid: number): PlayerGameSession {
    if (!this.state!.playerSessions.has(fid)) {
      this.state!.playerSessions.set(fid, {
        fid,
        activeMatches: new Map(),
        completedMatchIds: new Set(),
        facedOpponents: new Map(),
        currentRound: 0,
        nextRoundStartTime: undefined,
      });
    }
    return this.state!.playerSessions.get(fid)!;
  }

  private getAvailableOpponentsCount(_fid: number): number {
    return this.state!.players.size - 1 + (this.state!.bots.size - 1);
  }

  private createMatchForSlot(
    fid: number,
    slotNumber: 1 | 2,
    session: PlayerGameSession,
  ): Match | null {
    const player = this.state!.players.get(fid);
    if (!player) return null;

    const opponent = this.selectOpponent(fid, session);
    if (!opponent) return null;

    const now = Date.now();
    const match: Match = {
      id: `match-${player.fid}-${opponent.fid}-${now}-s${slotNumber}`,
      player,
      opponent,
      startTime: now,
      endTime: now + MATCH_DURATION,
      messages: [],
      isVotingComplete: false,
      isFinished: false,
      slotNumber,
      roundNumber: session.currentRound,
      voteHistory: [],
      voteLocked: false,
      lastPlayerMessageTime: now,
    };

    this.state!.matches.set(match.id, match);
    persistence.saveMatch(match).catch(console.error);

    // Bot proactive opening
    if (opponent.type === "BOT" && opponent.personality) {
      const { generateProactiveOpening } = require("./botProactive");
      const openingMessage = generateProactiveOpening(opponent.personality);
      if (openingMessage) {
        this.addMessageToMatch(match.id, openingMessage, opponent.fid).catch(console.error);
      }
    }

    const facedCount = session.facedOpponents.get(opponent.fid) || 0;
    session.facedOpponents.set(opponent.fid, facedCount + 1);

    return match;
  }

  private selectOpponent(
    playerFid: number,
    session: PlayerGameSession,
  ): Player | Bot | null {
    const allOpponents = [
      ...Array.from(this.state!.players.values()).filter(p => p.fid !== playerFid),
      ...Array.from(this.state!.bots.values()).filter(b => b.fid !== playerFid),
    ];

    if (allOpponents.length === 0) return null;

    const totalOpponents = allOpponents.length;
    const matchesPlayed = session.completedMatchIds.size;
    const allowRepeats = matchesPlayed >= totalOpponents;
    const maxFaceCount = allowRepeats ? Math.ceil(matchesPlayed / totalOpponents) : 1;

    let availableOpponents = allOpponents.filter(
      o => (session.facedOpponents.get(o.fid) || 0) < maxFaceCount,
    );

    if (availableOpponents.length === 0) {
      availableOpponents = allOpponents;
    }

    availableOpponents.sort((a, b) => {
      const aFaced = session.facedOpponents.get(a.fid) || 0;
      const bFaced = session.facedOpponents.get(b.fid) || 0;
      return aFaced - bFaced;
    });

    const realPlayers = availableOpponents.filter(o => o.type === "REAL");
    const bots = availableOpponents.filter(o => o.type === "BOT");

    const idealBotRatio = Math.min(0.6, Math.max(0.4, bots.length / availableOpponents.length));
    const currentBotRatio = this.calculateBotRatio(session);

    if (currentBotRatio < idealBotRatio && bots.length > 0) {
      return bots[0];
    } else if (realPlayers.length > 0) {
      return realPlayers[0];
    }

    return availableOpponents[0];
  }

  private calculateBotRatio(session: PlayerGameSession): number {
    const matches = Array.from(session.completedMatchIds)
      .map(id => this.state!.matches.get(id))
      .filter(Boolean);

    if (matches.length === 0) return 0;

    const botMatches = matches.filter(m => m!.opponent.type === "BOT").length;
    return botMatches / matches.length;
  }

  private async updateCycleState(): Promise<void> {
    const now = Date.now();

    // REGISTRATION -> LIVE
    if (this.state!.state === "REGISTRATION") {
      const playerCount = this.state!.players.size;

      // Start countdown once minimum players join
      if (!this.state!.countdownStarted && playerCount >= MIN_PLAYERS) {
        console.log(`[GameManager] Minimum ${MIN_PLAYERS} players reached, starting ${REGISTRATION_COUNTDOWN/1000}s countdown`);
        this.state!.countdownStarted = true;
        this.state!.registrationEnds = now + REGISTRATION_COUNTDOWN;
        await persistence.saveGameStateMeta({
          cycleId: this.state!.cycleId,
          state: this.state!.state,
          registrationEnds: this.state!.registrationEnds,
          gameEnds: this.state!.gameEnds,
        });
      }

      // Only check timer if countdown has started
      if (this.state!.countdownStarted && now > this.state!.registrationEnds) {
        console.log(`[GameManager] Registration countdown complete, starting game with ${playerCount} players`);
        this.state!.state = "LIVE";
        this.state!.gameEnds = now + GAME_DURATION;
        this.state!.extensionCount = 0;

        const playerFids = Array.from(this.state!.players.keys());
        getGameEventPublisher()
          .publishGameStart(this.state!.cycleId, playerFids)
          .catch(err => console.error("[updateCycleState] Failed to publish game_start:", err));
      }
    }

    // FINISHED state cleanup
    if (this.state!.state === "FINISHED") {
      const CLEANUP_GRACE_PERIOD = 5000;
      if (this.state!.finishedAt && now - this.state!.finishedAt > CLEANUP_GRACE_PERIOD) {
        this.state!.players.clear();
        this.state!.bots.clear();
        this.state!.playerSessions.clear();
        this.state!.matches.clear();
        this.state!.leaderboard = [];
        this.state!.finishedAt = undefined;
      }
      return;
    }

    // LIVE -> FINISHED
    if (this.state!.state === "LIVE" && now > this.state!.gameEnds) {
      const totalPlayers = this.state!.players.size;

      if (totalPlayers === 0 || this.state!.matches.size === 0) {
        this.state!.gameEnds = now + 60000;
        return;
      }

      let completedPlayers = 0;
      for (const [_fid, session] of this.state!.playerSessions) {
        const maxRounds = Math.floor(GAME_DURATION / MATCH_DURATION / SIMULTANEOUS_MATCHES);
        if (session.currentRound > maxRounds) {
          completedPlayers++;
        }
      }

      const hasPlayerSessions = this.state!.playerSessions.size > 0;
      const allPlayersComplete = hasPlayerSessions && completedPlayers === totalPlayers;
      const extensionLimitReached = this.state!.extensionCount >= this.state!.maxExtensions;
      const maxTotalDuration = GAME_DURATION + (this.state!.maxExtensions * 60 * 1000);
      const hardDeadlineExceeded = now > this.state!.gameEnds - GAME_DURATION + maxTotalDuration;

      let shouldFinish = false;

      if (allPlayersComplete) {
        shouldFinish = true;
      } else if (extensionLimitReached || hardDeadlineExceeded) {
        shouldFinish = true;
      }

      if (shouldFinish) {
        this.state!.state = "FINISHED";
        this.state!.finishedAt = now;
        this.state!.leaderboard = await this.getLeaderboard();

        this.saveGameResultsToDatabase().catch(console.error);

        const playerFids = Array.from(this.state!.players.keys());
        const leaderboardData = this.state!.leaderboard.map((entry, index) => ({
          fid: entry.player.fid,
          score: index + 1,
        }));

        getGameEventPublisher()
          .publishGameEnd(this.state!.cycleId, leaderboardData, playerFids)
          .catch(err => console.error("[updateCycleState] Failed to publish game_end:", err));
      } else if (this.state!.extensionCount < this.state!.maxExtensions) {
        this.state!.extensionCount++;
        this.state!.gameEnds = now + 60000;
      }
    }

    await persistence.saveGameStateMeta({
      cycleId: this.state!.cycleId,
      state: this.state!.state,
      registrationEnds: this.state!.registrationEnds,
      gameEnds: this.state!.gameEnds,
    });
  }

  private async cleanupOldMatches(): Promise<void> {
    const now = Date.now();
    const GRACE_PERIOD_MS = 10000;
    const matchesToDelete: string[] = [];

    for (const [matchId, match] of this.state!.matches) {
      const timeSinceEnd = now - match.endTime;

      if (match.voteLocked && match.isFinished && timeSinceEnd > GRACE_PERIOD_MS) {
        matchesToDelete.push(matchId);
      }
    }

    if (matchesToDelete.length > 0) {
      matchesToDelete.forEach(matchId => {
        this.state!.matches.delete(matchId);
        persistence.deleteMatch(matchId).catch(console.error);
      });
    }
  }

  private async saveMatchToDatabase(
    match: Match,
    isCorrect: boolean,
    voteSpeedMs: number,
  ): Promise<void> {
    try {
      const player = match.player;

      await database.saveMatch({
        id: match.id,
        cycle_id: this.state!.cycleId,
        player_fid: player.fid,
        opponent_fid: match.opponent.fid,
        opponent_type: match.opponent.type,
        slot_number: match.slotNumber,
        round_number: match.roundNumber,
        vote: match.currentVote || null,
        is_correct: isCorrect,
        vote_changes: match.voteHistory.length,
        vote_speed_ms: voteSpeedMs,
        messages: match.messages,
        started_at: new Date(match.startTime),
        ended_at: new Date(match.endTime),
      });

      await database.updatePlayerStats(
        player.fid,
        player.username,
        player.displayName,
        player.pfpUrl,
        { correct: isCorrect, speedMs: voteSpeedMs },
      );
    } catch (error) {
      console.error(`[saveMatchToDatabase] Failed to save match ${match.id}:`, error);
    }
  }

  private async saveGameResultsToDatabase(): Promise<void> {
    try {
      const leaderboard = this.state!.leaderboard;
      const totalPlayers = leaderboard.length;

      await database.saveGameCycle({
        id: this.state!.cycleId,
        chain: "local",
        state: this.state!.state,
        started_at: new Date(this.state!.registrationEnds),
        ended_at: new Date(),
        player_count: totalPlayers,
        entry_fee_wei: null,
        prize_pool_wei: null,
      });

      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const player = this.state!.players.get(entry.player.fid);
        if (!player) continue;

        const correctVotes = player.voteHistory.filter(v => v.correct && !v.forfeit).length;
        const totalVotes = player.voteHistory.length;

        await database.saveGameResult({
          cycle_id: this.state!.cycleId,
          player_fid: entry.player.fid,
          accuracy: entry.accuracy,
          correct_votes: correctVotes,
          total_votes: totalVotes,
          avg_speed_ms: Math.round(entry.avgSpeed),
          rank: i + 1,
          total_players: totalPlayers,
          prize_won_wei: null,
        });

        await database.incrementPlayerGames(entry.player.fid);
      }
    } catch (error) {
      console.error("[saveGameResultsToDatabase] Failed to save game results:", error);
    }
  }
}

const globalForGame = global as unknown as { gameManager: GameManager };

export const gameManager =
  globalForGame.gameManager || GameManager.getInstance();

if (process.env.NODE_ENV !== "production") {
  globalForGame.gameManager = gameManager;
}
