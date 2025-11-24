// src/lib/gameState.ts
import {
  GameState,
  Player,
  Bot,
  Match,
  LeaderboardEntry,
  UserProfile,
  PlayerGameSession,
  VoteRecord,
} from "./types";

const GAME_DURATION = 5 * 60 * 1000; // 5 minutes
const REGISTRATION_DURATION = 1 * 60 * 1000; // 1 minute for testing
const MAX_PLAYERS = 50;
const MATCH_DURATION = 60 * 1000; // 1 minute per match
const SIMULTANEOUS_MATCHES = 2; // 2 concurrent chats
const INACTIVITY_WARNING = 30 * 1000; // 30 seconds
const INACTIVITY_FORFEIT = 45 * 1000; // 45 seconds

// Dynamic round calculation based on game and match duration
const MAX_ROUNDS = Math.floor(
  GAME_DURATION / MATCH_DURATION / SIMULTANEOUS_MATCHES,
);

/**
 * Manages the in-memory state of the game.
 * Implemented as a singleton to ensure a single source of truth.
 */
class GameManager {
  private static instance: GameManager;
  private state: GameState;

  private constructor() {
    this.state = this.initializeGameState();
  }

  /**
   * Gets the singleton instance of the GameManager.
   */
  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * Initializes or resets the game state to its default.
   */
  private initializeGameState(): GameState {
    const now = Date.now();
    return {
      cycleId: `cycle-${now}`,
      state: "REGISTRATION",
      registrationEnds: now + REGISTRATION_DURATION,
      gameEnds: now + GAME_DURATION,
      players: new Map<number, Player>(),
      bots: new Map<number, Bot>(),
      matches: new Map<string, Match>(),
      playerSessions: new Map<number, PlayerGameSession>(),
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
   * Returns the current game state.
   */
  public getGameState(): GameState {
    this.updateCycleState();
    return this.state;
  }

  /**
   * Registers a new player and creates a corresponding bot for them.
   */
  public registerPlayer(
    userProfile: UserProfile,
    recentCasts: { text: string }[],
    style: string,
  ): Player | null {
    if (this.state.players.size >= MAX_PLAYERS) {
      console.warn("Max players reached. Cannot register new player.");
      return null;
    }
    if (this.state.players.has(userProfile.fid)) {
      return this.state.players.get(userProfile.fid)!;
    }

    // Create and add the real player
    const newPlayer: Player = {
      ...userProfile,
      type: "REAL",
      isRegistered: true,
      score: 0,
      voteHistory: [],
      inactivityStrikes: 0,
      lastActiveTime: Date.now(),
    };
    this.state.players.set(userProfile.fid, newPlayer);

    // Create and add the corresponding bot
    const newBot: Bot = {
      ...userProfile,
      type: "BOT",
      originalAuthor: userProfile,
      recentCasts,
      style,
    };
    this.state.bots.set(userProfile.fid, newBot);

    return newPlayer;
  }

  /**
   * Get or create a player's game session
   */
  private getOrCreateSession(fid: number): PlayerGameSession {
    if (!this.state.playerSessions.has(fid)) {
      this.state.playerSessions.set(fid, {
        fid,
        activeMatches: new Map(),
        completedMatchIds: new Set(),
        facedOpponents: new Map(),
        currentRound: 1,
        nextRoundStartTime: Date.now(),
      });
    }
    return this.state.playerSessions.get(fid)!;
  }

  /**
   * Get all active matches for a player (creates new ones as needed)
   */
  public getActiveMatches(fid: number): Match[] {
    const player = this.state.players.get(fid);
    if (!player || this.state.state !== "LIVE") return [];

    const session = this.getOrCreateSession(fid);
    const now = Date.now();
    const matches: Match[] = [];

    // Calculate maximum possible matches based on available opponents
    const totalOpponents = this.getAvailableOpponentsCount(fid);
    const maxPossibleMatches =
      totalOpponents * this.state.config.simultaneousMatches;
    const maxRounds = Math.min(
      MAX_ROUNDS,
      Math.ceil(maxPossibleMatches / this.state.config.simultaneousMatches),
    );

    // Check if game should end for this player
    if (session.currentRound > maxRounds) {
      return [];
    }

    // Check if we should start a new round
    if (session.nextRoundStartTime && now >= session.nextRoundStartTime) {
      // Clear old matches and start new round
      session.activeMatches.clear();
      session.currentRound++;
      session.nextRoundStartTime = now + this.state.config.matchDurationMs;

      // Create matches for both slots
      for (
        let slotNum = 1;
        slotNum <= this.state.config.simultaneousMatches;
        slotNum++
      ) {
        const match = this.createMatchForSlot(fid, slotNum as 1 | 2, session);
        if (match) {
          session.activeMatches.set(slotNum, match.id);
          matches.push(match);
        }
      }
    } else {
      // Return existing active matches
      for (const [_slotNum, matchId] of session.activeMatches) {
        const match = this.state.matches.get(matchId);
        if (match && match.endTime > now) {
          matches.push(match);
        }
      }
    }

    return matches;
  }

  /**
   * Get count of available opponents for a player
   */
  private getAvailableOpponentsCount(_fid: number): number {
    const totalPlayers = this.state.players.size;
    const totalBots = this.state.bots.size;

    // Subtract 1 to exclude the player themselves
    // Note: A player's own bot clone is excluded from their opponent pool
    return totalPlayers - 1 + (totalBots - 1);
  }

  /**
   * Create a single match for a specific slot
   */
  private createMatchForSlot(
    fid: number,
    slotNumber: 1 | 2,
    session: PlayerGameSession,
  ): Match | null {
    const player = this.state.players.get(fid);
    if (!player) return null;

    const opponent = this.selectOpponent(fid, session);
    if (!opponent) return null;

    const now = Date.now();
    const match: Match = {
      id: `match-${player.fid}-${opponent.fid}-${now}-s${slotNumber}`,
      player,
      opponent,
      startTime: now,
      endTime: now + this.state.config.matchDurationMs,
      messages: [],
      isVotingComplete: false,
      isFinished: false,
      slotNumber: slotNumber,
      roundNumber: session.currentRound,
      voteHistory: [],
      voteLocked: false,
      lastPlayerMessageTime: now,
    };

    this.state.matches.set(match.id, match);

    // Update faced opponents tracking
    const facedCount = session.facedOpponents.get(opponent.fid) || 0;
    session.facedOpponents.set(opponent.fid, facedCount + 1);

    return match;
  }

  /**
   * Select an appropriate opponent for a player
   */
  private selectOpponent(
    playerFid: number,
    session: PlayerGameSession,
  ): Player | Bot | null {
    const allOpponents = [
      ...Array.from(this.state.players.values()).filter(
        (p) => p.fid !== playerFid,
      ),
      ...Array.from(this.state.bots.values()).filter(
        (b) => b.fid !== playerFid,
      ),
    ];

    if (allOpponents.length === 0) return null;

    // Calculate repeat threshold based on total opponents
    // Allow repeats only when necessary
    const totalOpponents = allOpponents.length;
    const matchesPlayed = session.completedMatchIds.size;
    const allowRepeats = matchesPlayed >= totalOpponents;

    // Filter out opponents who have been faced too many times
    const maxFaceCount = allowRepeats
      ? Math.ceil(matchesPlayed / totalOpponents)
      : 1;
    const availableOpponents = allOpponents.filter(
      (o) => (session.facedOpponents.get(o.fid) || 0) < maxFaceCount,
    );

    // If no available opponents due to repeat restrictions, use all opponents
    const opponentsToChooseFrom =
      availableOpponents.length > 0 ? availableOpponents : allOpponents;

    // Sort by least faced first
    opponentsToChooseFrom.sort((a, b) => {
      const aFaced = session.facedOpponents.get(a.fid) || 0;
      const bFaced = session.facedOpponents.get(b.fid) || 0;
      return aFaced - bFaced;
    });

    // Dynamic balancing based on player pool size
    const realPlayers = opponentsToChooseFrom.filter((o) => o.type === "REAL");
    const bots = opponentsToChooseFrom.filter((o) => o.type === "BOT");

    // Calculate ideal bot ratio (aim for 40-60% bots depending on pool)
    const idealBotRatio = Math.min(
      0.6,
      Math.max(0.4, bots.length / opponentsToChooseFrom.length),
    );
    const currentBotRatio = this.calculateBotRatio(session);

    // Select based on maintaining balance
    if (currentBotRatio < idealBotRatio && bots.length > 0) {
      return bots[0];
    } else if (realPlayers.length > 0) {
      return realPlayers[0];
    }

    // Return least faced opponent
    return opponentsToChooseFrom[0];
  }

  /**
   * Calculate the ratio of bot opponents faced by a player
   */
  private calculateBotRatio(session: PlayerGameSession): number {
    const matches = Array.from(session.completedMatchIds)
      .map((id) => this.state.matches.get(id))
      .filter(Boolean);

    if (matches.length === 0) return 0;

    const botMatches = matches.filter((m) => m!.opponent.type === "BOT").length;
    return botMatches / matches.length;
  }

  /**
   * Retrieves a match by its ID.
   */
  public getMatch(matchId: string): Match | undefined {
    return this.state.matches.get(matchId);
  }

  /**
   * Adds a message to a match's chat history.
   */
  public addMessageToMatch(matchId: string, text: string, senderFid: number) {
    const match = this.getMatch(matchId);
    const sender =
      this.state.players.get(senderFid) || this.state.bots.get(senderFid);
    if (!match || !sender) return null;

    const message = {
      id: `msg-${Date.now()}`,
      sender: { fid: sender.fid, username: sender.username },
      text,
      timestamp: Date.now(),
    };

    match.messages.push(message);
    return message;
  }

  /**
   * Update the current vote for a match (can be called multiple times)
   */
  public updateMatchVote(matchId: string, vote: "REAL" | "BOT"): Match | null {
    const match = this.state.matches.get(matchId);
    if (!match || match.voteLocked) return null;

    match.currentVote = vote;
    match.voteHistory.push({
      vote,
      timestamp: Date.now(),
    });

    // Auto-lock if time is up
    if (Date.now() >= match.endTime) {
      this.lockMatchVote(matchId);
    }

    return match;
  }

  /**
   * Lock the vote for a match and record the result
   */
  public lockMatchVote(matchId: string): boolean | null {
    const match = this.state.matches.get(matchId);
    if (!match || match.voteLocked) return null;

    match.voteLocked = true;
    match.isVotingComplete = true;

    const player = match.player;
    const guess = match.currentVote || "REAL"; // Default to REAL if no vote
    const actualType = match.opponent.type;
    const isCorrect = guess === actualType;

    const voteRecord: VoteRecord = {
      matchId,
      correct: isCorrect,
      speed: match.currentVote
        ? match.voteHistory[match.voteHistory.length - 1].timestamp -
          match.startTime
        : match.endTime - match.startTime,
      voteChanges: match.voteHistory.length,
    };

    player.voteHistory.push(voteRecord);

    // Mark session as completed
    const session = this.state.playerSessions.get(player.fid);
    if (session) {
      session.completedMatchIds.add(matchId);
      // Remove from active matches
      for (const [slot, id] of session.activeMatches) {
        if (id === matchId) {
          session.activeMatches.delete(slot);
          break;
        }
      }
    }

    return isCorrect;
  }

  /**
   * Records a player's vote for a given match (legacy support).
   * @returns A boolean indicating if the guess was correct, or null if vote failed.
   */
  public recordVote(
    voterFid: number,
    matchId: string,
    guess: "REAL" | "BOT",
  ): boolean | null {
    const player = this.state.players.get(voterFid);
    const match = this.state.matches.get(matchId);

    if (!player || !match || match.isVotingComplete) {
      return null;
    }

    // Ensure voting happens only after the match is over
    if (Date.now() < match.endTime) {
      return null;
    }

    const actualType = match.opponent.type;
    const isCorrect = guess === actualType;
    const voteSpeed = Date.now() - match.endTime; // Time in ms since match ended

    player.voteHistory.push({
      matchId,
      correct: isCorrect,
      speed: voteSpeed,
      voteChanges: 0,
    });

    match.isVotingComplete = true;

    return isCorrect;
  }

  /**
   * Updates the game state based on the current time.
   */
  private updateCycleState(): void {
    const now = Date.now();
    if (
      this.state.state === "REGISTRATION" &&
      now > this.state.registrationEnds
    ) {
      this.state.state = "LIVE";
    }
    if (this.state.state === "LIVE" && now > this.state.gameEnds) {
      this.state.state = "FINISHED";
      // Calculate and store the final leaderboard once the game is finished.
      this.state.leaderboard = this.getLeaderboard();
    }
  }

  /**
   * Calculates and returns the current leaderboard, sorted by score.
   * This can be used for both provisional and final leaderboards.
   */
  public getLeaderboard(): LeaderboardEntry[] {
    const leaderboard: LeaderboardEntry[] = Array.from(
      this.state.players.values(),
    ).map((player) => {
      const correctVotes = player.voteHistory.filter(
        (v) => v.correct && !v.forfeit,
      );
      const accuracy =
        player.voteHistory.length > 0
          ? (correctVotes.length / player.voteHistory.length) * 100
          : 0;
      const avgSpeed =
        correctVotes.length > 0
          ? correctVotes.reduce((sum, v) => sum + v.speed, 0) /
            correctVotes.length
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

    // Sort by accuracy (desc), then by speed (asc)
    leaderboard.sort((a, b) => {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      return a.avgSpeed - b.avgSpeed;
    });

    return leaderboard;
  }

  // ========== ADMIN METHODS (Dev/Testing Only) ==========

  /**
   * Manually force a state transition (for testing).
   * @param newState The state to transition to
   */
  public forceStateTransition(
    newState: "REGISTRATION" | "LIVE" | "FINISHED",
  ): void {
    this.state.state = newState;
    if (newState === "FINISHED") {
      this.state.leaderboard = this.getLeaderboard();
    }
  }

  /**
   * Reset the entire game state (for testing).
   */
  public resetGame(): void {
    this.state = this.initializeGameState();
  }

  /**
   * Get all players (for admin view).
   */
  public getAllPlayers(): Player[] {
    return Array.from(this.state.players.values());
  }

  /**
   * Get all bots (for admin view).
   */
  public getAllBots(): Bot[] {
    return Array.from(this.state.bots.values());
  }

  /**
   * Get all matches (for admin view).
   */
  public getAllMatches(): Match[] {
    return Array.from(this.state.matches.values());
  }
}

// Export a singleton instance of the GameManager
const globalForGame = global as unknown as { gameManager: GameManager };

export const gameManager =
  globalForGame.gameManager || GameManager.getInstance();

if (process.env.NODE_ENV !== "production") {
  globalForGame.gameManager = gameManager;
}
