// src/lib/gameState.ts
/**
 * Game State Manager - Single Source of Truth
 * 
 * Unified async interface for all game operations.
 * Works with both Redis (production) and in-memory (development).
 * 
 * ARCHITECTURE:
 * - Singleton pattern with lazy initialization
 * - Three state phases: REGISTRATION → LIVE → FINISHED (auto-cycles)
 * - Version-based locking prevents concurrent state transitions across serverless instances
 * - Minimal Redis reads: only load metadata, full collections loaded only on version mismatch
 * 
 * PHASE HANDLERS (each handles one-way transitions):
 * - handleRegistrationPhase(): Countdown start + REGISTRATION→LIVE
 * - handleLiveToFinished(): LIVE→FINISHED when timer expires
 * - handleFinishedPhase(): FINISHED→REGISTRATION with cleanup (auto-cycle)
 * 
 * Core Principles:
 * - All methods are async (Promise-based)
 * - Single initialization pattern
 * - Clear state lifecycle management
 * - DRY: Consolidated atomic transition pattern across all phase handlers
 * - CLEAN: Separated concerns into phase-specific handlers
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
import * as stateConsistency from "./stateConsistency";
import { database } from "./database";
import { inferPersonality } from "./botProactive";
import { getRepository } from "./gameRepository";
import { saveConversationContext, saveConversationMemory, clearAllConversationContexts } from "./conversationContext";
import { extractCoherenceScoresFromMatch, clearConversationState } from "./inference";

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
        
        // Mark cache as fresh - version is loaded from Redis
        const version = await stateConsistency.loadStateVersion();
        stateConsistency.markCacheFresh(version || 0);
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
        
        // Mark cache as fresh (version 0 for new cycle)
        stateConsistency.markCacheFresh(0);
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
      gameEnds: now + 999999999, // Also far future during registration
      players: new Map(),
      bots: new Map(),
      matches: new Map(),
      playerSessions: new Map(),
      leaderboard: [],
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
   * 
   * ARCHITECTURE:
   * - Metadata (state, timers) cached in memory - only reload on version change
   * - Collections (players, bots, matches) loaded on-demand via repository
   * - Repository handles caching with TTL + version invalidation
   * 
   * CRITICAL: Only reload metadata when version bumps (state transitions).
   * Avoids flashing/jitter from Redis reloads every request.
   */
  async getGameState() {
    await this.ensureInitialized();
    
    // Check for version bump FIRST - this tells us if metadata changed
    const versionChanged = await stateConsistency.hasVersionChanged();
    
    // Only reload metadata from Redis if version changed
    // Otherwise use in-memory cache (prevents flashing/jitter)
    if (versionChanged) {
      const stateMeta = await persistence.loadGameStateMeta();
      if (stateMeta) {
        this.state!.state = stateMeta.state;
        this.state!.registrationEnds = stateMeta.registrationEnds;
        this.state!.gameEnds = stateMeta.gameEnds;
        this.state!.finishedAt = stateMeta.finishedAt;
      }
      getRepository().invalidateAll();
    }
    
    // Update state based on timers every time it's requested
    await this.updateCycleState();
    await this.cleanupOldMatches();

    // Get player count from repository (may be cached)
    const players = await getRepository().getPlayers();
    this.state!.players = players;

    return {
      cycleId: this.state!.cycleId,
      state: this.state!.state,
      registrationEnds: this.state!.registrationEnds,
      gameEnds: this.state!.gameEnds,
      playerCount: this.state!.players.size,
      config: this.state!.config,
      isRegistered: false, // Will be set by routes if needed
      finishedAt: this.state!.finishedAt, // For calculating next cycle time
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

    // Invalidate player and bot caches so other methods see the new player
    getRepository().invalidateCache('players');
    getRepository().invalidateCache('bots');

    // Note: We do NOT increment state version here
    // Player registration is a collection change, not a phase transition
    // Repository TTL cache and version tracking handle consistency

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

    // Load fresh matches and sessions via repository (may use cache)
    const matchesMap = await getRepository().getMatches();
    this.state!.matches = matchesMap;

    const sessions = await getRepository().getSessions();
    this.state!.playerSessions = sessions;

    const player = this.state!.players.get(fid);
    if (!player || this.state!.state !== "LIVE") {
      return [];
    }

    const session = this.getOrCreateSession(fid);
    const now = Date.now();
    const activeMatches: Match[] = [];

    // Use fixed rounds for predictable experience
    const maxRounds = FIXED_ROUNDS;

    if (session.currentRound > maxRounds) {
      return [];
    }

    // SYNCHRONIZED ROUNDS: Calculate which round should be active based on game time
    // This ensures all players progress through rounds at the same time
    const gameStartTime = this.state!.gameStartTime || this.state!.registrationEnds + REGISTRATION_COUNTDOWN;
    const elapsedTime = now - gameStartTime;
    const expectedRound = Math.floor(elapsedTime / MATCH_DURATION) + 1;
    
    // If expected round is ahead of player's current round, advance them
    if (expectedRound > session.currentRound && expectedRound <= maxRounds) {
      console.log(`[GameManager] FID ${fid} auto-advanced: round ${session.currentRound} → ${expectedRound} (game time based)`);
      session.currentRound = expectedRound;
      session.activeMatches.clear();
    }

    // If game time has exceeded all rounds, mark as complete
    if (expectedRound > maxRounds && session.currentRound <= maxRounds) {
      console.log(`[GameManager] FID ${fid} all rounds complete (game timer exceeded)`);
      session.currentRound = maxRounds + 1;
      session.activeMatches.clear();
      return [];
    }

    // Check existing matches - auto-lock expired ones, remove completed ones
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
        activeMatches.push(match);
      }
      }

      if (!session.currentRound || session.currentRound === 0) {
      // Initialize round 1
      console.log(`[GameManager] Initializing round 1 for FID ${fid}`);
      session.currentRound = 1;
      session.activeMatches.clear();

      const selectedThisRound = new Set<number>();

      for (let slotNum = 1; slotNum <= SIMULTANEOUS_MATCHES; slotNum++) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session, selectedThisRound, gameStartTime);
        if (match) {
          selectedThisRound.add(match.opponent.fid);
          session.activeMatches.set(slotNum, match.id);
          activeMatches.push(match);
        }
      }
      } else if (session.activeMatches.size === 0 && session.currentRound <= maxRounds) {
      // Matches were all locked/removed from this round, create next round's matches
      console.log(`[GameManager] Creating new matches for round ${session.currentRound} for FID ${fid}`);
      
      const selectedThisRound = new Set<number>();

      for (let slotNum = 1; slotNum <= SIMULTANEOUS_MATCHES; slotNum++) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session, selectedThisRound, gameStartTime);
        if (match) {
          selectedThisRound.add(match.opponent.fid);
          session.activeMatches.set(slotNum, match.id);
          activeMatches.push(match);
        } else {
          console.warn(`[GameManager] Failed to create match for FID ${fid} round ${session.currentRound} slot ${slotNum}`);
        }
      }
      }

      await persistence.saveSession(session);
      return activeMatches;
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

      // Remove from active matches (round progression is now time-based, not event-based)
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

    // PHASE 2: Save conversation context for future rounds (async, non-blocking)
    // Only if opponent is a bot (we track context between player and bot)
    if (match.opponent.type === "BOT") {
      saveConversationContext(
        player.fid,
        match.opponent.fid,
        match.roundNumber,
        this.state!.cycleId,
        match.messages
      ).catch(err => console.warn(`[lockMatchVote] Failed to save context:`, err));

      // Also save temporal memory with coherence scores for enhanced learning
      const coherenceScores = extractCoherenceScoresFromMatch(matchId);
      saveConversationMemory(
        player.fid,
        match.opponent.fid,
        match.messages,
        coherenceScores.length > 0 ? coherenceScores : undefined
      ).catch(err => console.warn(`[lockMatchVote] Failed to save memory:`, err));

      // Cleanup conversation state cache
      clearConversationState(matchId);
    }

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

    // Load fresh players via repository to ensure vote history is current
    const players = await getRepository().getPlayers();
    this.state!.players = players;

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
    } else if (newState === "LIVE") {
      this.state!.registrationEnds = now - 1;
      this.state!.gameEnds = now + GAME_DURATION;
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
    // Also clear conversation contexts on full reset
    await clearAllConversationContexts();
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
      });
    }
    return this.state!.playerSessions.get(fid)!;
  }

  private createMatchForSlot(
    fid: number,
    slotNumber: 1 | 2,
    session: PlayerGameSession,
    excludeFids?: Set<number>,
    gameStartTime?: number,
  ): Match | null {
    const player = this.state!.players.get(fid);
    if (!player) return null;

    const opponent = this.selectOpponent(fid, session, excludeFids);
    if (!opponent) return null;

    // Check if match already exists for this opponent in this round
    const existingMatch = Array.from(this.state!.matches.values()).find(
      m => m.roundNumber === session.currentRound && 
           m.slotNumber === slotNumber &&
           m.player.fid === fid
    );
    
    if (existingMatch) {
      return existingMatch;
    }

    const now = Date.now();
    
    // SYNCHRONIZED ROUND TIMING: All matches in a round end at the same absolute time
    // Calculate the round end time based on when the game started
    const actualGameStartTime = gameStartTime || this.state!.gameStartTime || this.state!.registrationEnds + REGISTRATION_COUNTDOWN;
    const roundStartTime = actualGameStartTime + ((session.currentRound - 1) * MATCH_DURATION);
    const roundEndTime = roundStartTime + MATCH_DURATION;
    
    const match: Match = {
      id: `match-${player.fid}-${opponent.fid}-${now}-s${slotNumber}`,
      player,
      opponent,
      startTime: roundStartTime,
      endTime: roundEndTime, // All matches in this round have same endTime
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

  /**
   * Reload all game data from Redis.
   * Called when version mismatch detected (another instance changed state).
   * Uses repository to reload collections.
   */
  private async reloadFromRedis(): Promise<void> {
    console.log("[GameManager] Reloading state from Redis due to version change");
    
    const stateMeta = await persistence.loadGameStateMeta();
    if (stateMeta) {
      this.state!.cycleId = stateMeta.cycleId;
      this.state!.state = stateMeta.state;
      this.state!.registrationEnds = stateMeta.registrationEnds;
      this.state!.gameEnds = stateMeta.gameEnds;
      this.state!.finishedAt = stateMeta.finishedAt;
    }

    // Invalidate repository cache to force fresh load
    getRepository().invalidateAll();

    // Reload all collections via repository
    this.state!.players = await getRepository().getPlayers();
    this.state!.bots = await getRepository().getBots();
    this.state!.playerSessions = await getRepository().getSessions();
    this.state!.matches = await getRepository().getMatches();

    // Mark cache as fresh at the new version
    const version = await stateConsistency.loadStateVersion();
    if (version !== null && version !== undefined) {
      stateConsistency.markCacheFresh(version);
    }
  }

  /**
   * Attempt atomic state transition (version-based locking).
   * Pattern: Try increment → reload on loss → perform transition
   * Returns true if this instance won the race and should complete the transition.
   * CLEAN: Consolidates the atomic transition pattern used by all state changes.
   */
  private async attemptAtomicTransition(description: string): Promise<boolean> {
    const didIncrement = await stateConsistency.tryIncrementStateVersion();
    
    if (!didIncrement) {
      // Another instance won the race, reload their state and bail
      await this.reloadFromRedis();
      console.log(`[GameManager] Another instance is handling ${description}, reloaded state`);
      return false;
    }

    console.log(`[GameManager] Won race for ${description}`);
    return true;
  }

  /**
   * Handle REGISTRATION phase: start countdown when MIN_PLAYERS reached, transition to LIVE when countdown expires.
   * CLEAN: Encapsulates all registration state logic in one place.
   */
  private async handleRegistrationPhase(now: number): Promise<void> {
    const playerCount = this.state!.players.size;
    const countdownHasStarted = this.state!.registrationEnds < now + 60000; // Not at far-future value

    // Start countdown once minimum players join
    if (!countdownHasStarted && playerCount >= MIN_PLAYERS) {
      if (!await this.attemptAtomicTransition("starting countdown")) {
        return;
      }

      console.log(`[GameManager] Minimum ${MIN_PLAYERS} players reached, starting ${REGISTRATION_COUNTDOWN / 1000}s countdown`);
      this.state!.registrationEnds = now + REGISTRATION_COUNTDOWN;
      await persistence.saveGameStateMeta({
        cycleId: this.state!.cycleId,
        state: this.state!.state,
        registrationEnds: this.state!.registrationEnds,
        gameEnds: this.state!.gameEnds,
      });
    }

    // Transition to LIVE when countdown expires
    if (countdownHasStarted && now > this.state!.registrationEnds) {
      if (!await this.attemptAtomicTransition("REGISTRATION → LIVE")) {
        return;
      }

      console.log(`[GameManager] Registration countdown complete, starting game with ${playerCount} players`);
      this.state!.state = "LIVE";
      this.state!.gameStartTime = now;
      this.state!.gameEnds = now + GAME_DURATION;

      await persistence.saveGameStateMeta({
        cycleId: this.state!.cycleId,
        state: this.state!.state,
        registrationEnds: this.state!.registrationEnds,
        gameEnds: this.state!.gameEnds,
      });
    }
  }

  /**
   * Handle LIVE → FINISHED transition: occurs when game timer expires.
   * CLEAN: Encapsulates game end logic.
   */
  private async handleLiveToFinished(now: number): Promise<void> {
    const totalPlayers = this.state!.players.size;
    const completedPlayers = Array.from(this.state!.playerSessions.values()).filter(
      s => s.currentRound > FIXED_ROUNDS
    ).length;

    console.log(`[GameManager] LIVE → FINISHED: ${completedPlayers}/${totalPlayers} players completed`);
    
    this.state!.state = "FINISHED";
    this.state!.finishedAt = now;
    this.state!.leaderboard = await this.getLeaderboard();
    
    // Persist state transition and increment version atomically
    await persistence.saveGameStateMeta({
      cycleId: this.state!.cycleId,
      state: this.state!.state,
      registrationEnds: this.state!.registrationEnds,
      gameEnds: this.state!.gameEnds,
      finishedAt: this.state!.finishedAt,
    });
    
    await stateConsistency.tryIncrementStateVersion();
    
    // Save results async (non-blocking)
    this.saveGameResultsToDatabase().catch(console.error);
  }

  /**
   * Handle FINISHED → REGISTRATION transition: auto-cycle after cleanup grace period.
   * CLEAN: Encapsulates cycle reset logic.
   */
  private async handleFinishedPhase(now: number): Promise<void> {
    const CLEANUP_GRACE_PERIOD = 5000;
    if (!this.state!.finishedAt || now - this.state!.finishedAt <= CLEANUP_GRACE_PERIOD) {
      return; // Not ready to cycle yet
    }

    if (!await this.attemptAtomicTransition("FINISHED → REGISTRATION")) {
      return;
    }

    // This instance won the race, perform the cycle transition
    const newCycleId = `cycle-${this.state!.finishedAt}`;
    console.log(`[GameManager] Performing cycle transition to ${newCycleId}`);

    // Clear in-memory game data
    this.state!.players.clear();
    this.state!.bots.clear();
    this.state!.playerSessions.clear();
    this.state!.matches.clear();
    this.state!.leaderboard = [];

    // Start new cycle with deterministic ID
    this.state!.cycleId = newCycleId;
    this.state!.state = "REGISTRATION";
    this.state!.registrationEnds = now + 999999999;
    this.state!.gameEnds = now + 999999999;
    this.state!.finishedAt = undefined;

    // Clear all player data from Redis FIRST (before state meta update)
    // This prevents race condition where other instances load old data
    if (USE_REDIS) {
      await persistence.clearAllPlayers();
      await persistence.clearAllBots();
      await persistence.clearAllSessions();
      await persistence.clearAllMatches();
    }

    // Then atomically save new state to Redis
    await persistence.saveGameStateMeta({
      cycleId: this.state!.cycleId,
      state: this.state!.state,
      registrationEnds: this.state!.registrationEnds,
      gameEnds: this.state!.gameEnds,
    });
  }

  private async updateCycleState(): Promise<void> {
   // Load latest metadata from Redis (minimal read, not full collections yet)
   const stateMeta = await persistence.loadGameStateMeta();
   if (stateMeta) {
     this.state!.state = stateMeta.state;
     this.state!.registrationEnds = stateMeta.registrationEnds;
     this.state!.gameEnds = stateMeta.gameEnds;
     this.state!.finishedAt = stateMeta.finishedAt;
   }

   const now = Date.now();

    // REGISTRATION -> LIVE (two-phase: countdown start, then transition)
    if (this.state!.state === "REGISTRATION") {
      await this.handleRegistrationPhase(now);
    }

    // FINISHED -> REGISTRATION (auto-cycle with version-based atomicity)
    if (this.state!.state === "FINISHED") {
      await this.handleFinishedPhase(now);
      return;
    }

    // LIVE -> FINISHED: Timer expired = game over
    if (this.state!.state === "LIVE" && now > this.state!.gameEnds) {
      await this.handleLiveToFinished(now);
      return;
    }
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

      console.log(`[saveGameResultsToDatabase] Starting to save results for cycle ${this.state!.cycleId} with ${totalPlayers} players`);

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

      console.log(`[saveGameResultsToDatabase] Saved game cycle, now saving ${leaderboard.length} player results`);

      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const player = this.state!.players.get(entry.player.fid);
        if (!player) {
          console.warn(`[saveGameResultsToDatabase] Player ${entry.player.fid} not found in state`);
          continue;
        }

        const correctVotes = player.voteHistory.filter(v => v.correct && !v.forfeit).length;
        const totalVotes = player.voteHistory.length;

        console.log(`[saveGameResultsToDatabase] Saving result for FID ${entry.player.fid}: rank ${i + 1}, accuracy ${entry.accuracy.toFixed(1)}%, ${correctVotes}/${totalVotes} votes`);

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

      console.log(`[saveGameResultsToDatabase] ✓ Successfully saved all results for cycle ${this.state!.cycleId}`);
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
