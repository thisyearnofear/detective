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
import { inferPersonality } from "./botProactive";

// Game configuration constants
const MATCH_DURATION = 60 * 1000; // 1 minute per match
const SIMULTANEOUS_MATCHES = 2; // 2 concurrent chats
const FIXED_ROUNDS = 5; // Fixed 5 rounds for predictable experience (10 total matches)
const GAME_DURATION = FIXED_ROUNDS * MATCH_DURATION; // 5 minutes total
const REGISTRATION_COUNTDOWN = 30 * 1000; // 30 second countdown once minimum players join
const MIN_PLAYERS = 3; // Minimum players needed for a competitive game
const MAX_PLAYERS = 50;
const INACTIVITY_WARNING = 30 * 1000; // 30 seconds
const INACTIVITY_FORFEIT = 45 * 1000; // 45 seconds
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
      console.log(`[GameManager] Registration rejected for FID ${userProfile.fid}: Game full`);
      return null;
    }

    if (this.state!.players.has(userProfile.fid)) {
      console.log(`[GameManager] Player FID ${userProfile.fid} already registered`);
      return this.state!.players.get(userProfile.fid)!;
    }

    console.log(`[GameManager] Registering player FID ${userProfile.fid} (${userProfile.username})`);

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

    // Create bot with complete personality profile (includes linguistic + behavioral patterns)
    const botData: Bot = {
      ...userProfile,
      type: "BOT",
      originalAuthor: userProfile,
      recentCasts,
      style,
    };

    const bot: Bot = {
      ...botData,
      personality: inferPersonality(botData),
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

      return true;
    }

    return false;
  }

  /**
   * Get active matches for a player, creating new ones as needed.
   * DETERMINISTIC: Rounds advance immediately when all matches are voted.
   * No grace periods, no time-based transitions.
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

    // Check existing matches - auto-lock expired ones, remove completed ones
    let activeMatchCount = 0;

    for (const [slotNum, matchId] of session.activeMatches) {
      const match = this.state!.matches.get(matchId);
      if (!match) {
        // Match doesn't exist, remove from session
        session.activeMatches.delete(slotNum);
      } else if (match.endTime <= now && !match.voteLocked) {
        // Time expired and not locked yet - auto-lock
        await this.lockMatchVote(matchId);
        // After locking, remove from active matches
        session.activeMatches.delete(slotNum);
      } else if (match.voteLocked) {
        // Vote is locked (completed) - remove from active matches
        session.activeMatches.delete(slotNum);
      } else {
        // Still active and not expired
        matches.push(match);
        activeMatchCount++;
      }
    }

    // DETERMINISTIC ROUND PROGRESSION: Advance when all matches are complete
    const matchesPlayedThisRound = session.completedMatchesPerRound.get(session.currentRound) || 0;
    const isRoundComplete = activeMatchCount === 0 && session.activeMatches.size === 0 && matchesPlayedThisRound > 0;

    // Debug logging for round transitions
    if (activeMatchCount === 0 && session.activeMatches.size === 0) {
      console.log(`[GameManager] FID ${fid} Round ${session.currentRound}: isRoundComplete=${isRoundComplete}, matchesPlayedThisRound=${matchesPlayedThisRound}`);
    }

    if (!session.currentRound || session.currentRound === 0) {
      // Initialize round 1
      console.log(`[GameManager] Initializing round 1 for FID ${fid}`);
      session.currentRound = 1;
      session.activeMatches.clear();

      const selectedThisRound = new Set<number>();

      for (let slotNum = 1; slotNum <= SIMULTANEOUS_MATCHES; slotNum++) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session, selectedThisRound);
        if (match) {
          selectedThisRound.add(match.opponent.fid);
          session.activeMatches.set(slotNum, match.id);
          matches.push(match);
        }
      }
    } else if (isRoundComplete && session.currentRound < maxRounds) {
      // Advance to next round IMMEDIATELY (no grace period)
      console.log(`[GameManager] ✓ Round ${session.currentRound} complete for FID ${fid}, advancing to round ${session.currentRound + 1}`);
      session.currentRound++;
      session.activeMatches.clear();

      // Create new matches synchronously
      const selectedThisRound = new Set<number>();

      for (let slotNum = 1; slotNum <= SIMULTANEOUS_MATCHES; slotNum++) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session, selectedThisRound);
        if (match) {
          selectedThisRound.add(match.opponent.fid);
          session.activeMatches.set(slotNum, match.id);
          matches.push(match);
        } else {
          console.warn(`[GameManager] Failed to create match for FID ${fid} round ${session.currentRound} slot ${slotNum}`);
        }
      }
    } else if (isRoundComplete && session.currentRound === maxRounds) {
      // Last round complete
      console.log(`[GameManager] ✓ All rounds complete for FID ${fid}`);
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
    if (!match) {
      console.warn(`[updateMatchVote] Match ${matchId} not found`);
      return null;
    }

    if (match.voteLocked) {
      console.warn(`[updateMatchVote] Match ${matchId} is locked`);
      return null;
    }

    // Allow toggles only while the match is active (before endTime)
    // Small grace period (500ms) for network latency
    const now = Date.now();
    const VOTE_GRACE_PERIOD = 500; // 500ms grace for network latency

    if (now >= (match.endTime + VOTE_GRACE_PERIOD)) {
      // Time is up (with grace period), don't allow new toggles
      console.warn(`[updateMatchVote] Match ${matchId} time expired (now: ${now}, endTime: ${match.endTime}, grace: ${VOTE_GRACE_PERIOD}ms)`);
      return null;
    }

    match.currentVote = vote;
    match.voteHistory.push({ vote, timestamp: Date.now() });

    await persistence.saveMatch(match);
    console.log(`[updateMatchVote] Match ${matchId} vote updated to ${vote} (history: ${match.voteHistory.length} changes)`);
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

      // Increment completed matches for this round
      const currentCount = session.completedMatchesPerRound.get(match.roundNumber) || 0;
      session.completedMatchesPerRound.set(match.roundNumber, currentCount + 1);

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
   * Get total rounds for the game (single source of truth).
   */
  getTotalRounds(): number {
    return FIXED_ROUNDS;
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
      this.state!.registrationEnds = now + REGISTRATION_COUNTDOWN;
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
        completedMatchesPerRound: new Map(),
      });
    }
    return this.state!.playerSessions.get(fid)!;
  }

  private createMatchForSlot(
    fid: number,
    slotNumber: 1 | 2,
    session: PlayerGameSession,
    excludeFids?: Set<number>,
  ): Match | null {
    const player = this.state!.players.get(fid);
    if (!player) return null;

    const opponent = this.selectOpponent(fid, session, excludeFids);
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
    excludeFids?: Set<number>,
  ): Player | Bot | null {
    const allOpponents = [
      ...Array.from(this.state!.players.values()).filter(p => p.fid !== playerFid),
      ...Array.from(this.state!.bots.values()).filter(b => b.fid !== playerFid),
    ];

    if (allOpponents.length === 0) return null;

    // First filter: exclude opponents already selected this round
    let candidates = excludeFids
      ? allOpponents.filter(o => !excludeFids.has(o.fid))
      : allOpponents;

    // If all excluded (rare edge case), reset to all opponents
    if (candidates.length === 0) {
      candidates = allOpponents;
    }

    // Second filter: prefer opponents not faced recently
    const totalOpponents = candidates.length;
    const matchesPlayed = session.completedMatchIds.size;
    const allowRepeats = matchesPlayed >= totalOpponents;
    const maxFaceCount = allowRepeats ? Math.ceil(matchesPlayed / totalOpponents) : 1;

    let availableOpponents = candidates.filter(
      o => (session.facedOpponents.get(o.fid) || 0) < maxFaceCount,
    );

    if (availableOpponents.length === 0) {
      availableOpponents = candidates;
    }

    // Sort by least-faced first (fair distribution)
    availableOpponents.sort((a, b) => {
      const aFaced = session.facedOpponents.get(a.fid) || 0;
      const bFaced = session.facedOpponents.get(b.fid) || 0;
      return aFaced - bFaced;
    });

    // Balance bot/player ratio: target 40-60% bots
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
    // Reload state metadata from Redis to ensure consistency across serverless instances
    const stateMeta = await persistence.loadGameStateMeta();
    if (stateMeta) {
      this.state!.state = stateMeta.state;
      this.state!.registrationEnds = stateMeta.registrationEnds;
      this.state!.gameEnds = stateMeta.gameEnds;
    }

    const now = Date.now();

    // REGISTRATION -> LIVE
    if (this.state!.state === "REGISTRATION") {
      const playerCount = this.state!.players.size;

      // Start countdown once minimum players join
      if (!this.state!.countdownStarted && playerCount >= MIN_PLAYERS) {
        console.log(`[GameManager] Minimum ${MIN_PLAYERS} players reached, starting ${REGISTRATION_COUNTDOWN / 1000}s countdown`);
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

        // Persist state transition to Redis so all instances see LIVE state
        await persistence.saveGameStateMeta({
          cycleId: this.state!.cycleId,
          state: this.state!.state,
          registrationEnds: this.state!.registrationEnds,
          gameEnds: this.state!.gameEnds,
        });
      }
    }

    // FINISHED -> REGISTRATION (auto-cycle)
    if (this.state!.state === "FINISHED") {
      const CLEANUP_GRACE_PERIOD = 5000;
      if (this.state!.finishedAt && now - this.state!.finishedAt > CLEANUP_GRACE_PERIOD) {
        console.log(`[GameManager] Cleanup complete, starting new cycle`);

        // Clear game data
        this.state!.players.clear();
        this.state!.bots.clear();
        this.state!.playerSessions.clear();
        this.state!.matches.clear();
        this.state!.leaderboard = [];

        // Start new cycle
        this.state!.cycleId = `cycle-${Date.now()}`;
        this.state!.state = "REGISTRATION";
        this.state!.registrationEnds = now + REGISTRATION_COUNTDOWN;
        this.state!.gameEnds = now + GAME_DURATION;
        this.state!.countdownStarted = false;
        this.state!.extensionCount = 0;
        this.state!.finishedAt = undefined;

        await persistence.saveGameStateMeta({
          cycleId: this.state!.cycleId,
          state: this.state!.state,
          registrationEnds: this.state!.registrationEnds,
          gameEnds: this.state!.gameEnds,
        });
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
        if (session.currentRound > FIXED_ROUNDS) {
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
