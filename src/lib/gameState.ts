// src/lib/gameState.ts
import {
  GameState,
  Player,
  Bot,
  Match,
  LeaderboardEntry,
  UserProfile,
} from "./types";

const GAME_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRATION_DURATION = 1 * 60 * 60 * 1000; // 1 hour
const MAX_PLAYERS = 50;

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
      leaderboard: [],
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
    style: string
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
   * Finds the next opponent for a given player.
   */
  public createNextMatch(fid: number): Match | null {
    const player = this.state.players.get(fid);
    if (!player) return null;

    // 50% chance to play against a bot
    const playAgainstBot = Math.random() < 0.5;

    let opponent: Player | Bot | undefined;

    if (playAgainstBot && this.state.bots.size > 0) {
      // Pick a bot that is not impersonating the current player
      const availableBots = Array.from(this.state.bots.values()).filter(b => b.fid !== fid);
      if (availableBots.length > 0) {
        opponent = availableBots[Math.floor(Math.random() * availableBots.length)];
      }
    }

    // Fallback or if it's the 50% chance to play a real person
    if (!opponent) {
      const availablePlayers = Array.from(this.state.players.values()).filter(
        (p) => p.fid !== fid
      );
      if (availablePlayers.length > 0) {
        opponent =
          availablePlayers[
          Math.floor(Math.random() * availablePlayers.length)
          ];
      } else if (this.state.bots.size > 0) {
        // Fallback to a bot if no other players are available
        // Ensure we don't match against the player's own bot
        const availableBots = Array.from(this.state.bots.values()).filter(b => b.fid !== fid);
        if (availableBots.length > 0) {
          opponent = availableBots[Math.floor(Math.random() * availableBots.length)];
        }
      }
    }

    if (!opponent) return null;

    const now = Date.now();
    const match: Match = {
      id: `match-${player.fid}-${opponent.fid}-${now}`,
      player,
      opponent,
      startTime: now,
      endTime: now + 4 * 60 * 1000, // 4-minute match
      messages: [],
      isVotingComplete: false,
      isFinished: false,
    };

    this.state.matches.set(match.id, match);
    return match;
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
   * Records a player's vote for a given match.
   * @returns A boolean indicating if the guess was correct, or null if vote failed.
   */
  public recordVote(
    voterFid: number,
    matchId: string,
    guess: "REAL" | "BOT"
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
    });

    match.isVotingComplete = true;

    return isCorrect;
  }

  /**
   * Updates the game state based on the current time.
   */
  private updateCycleState(): void {
    const now = Date.now();
    if (this.state.state === "REGISTRATION" && now > this.state.registrationEnds) {
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
      this.state.players.values()
    ).map((player) => {
      const correctVotes = player.voteHistory.filter((v) => v.correct);
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
  public forceStateTransition(newState: "REGISTRATION" | "LIVE" | "FINISHED"): void {
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

export const gameManager = globalForGame.gameManager || GameManager.getInstance();

if (process.env.NODE_ENV !== 'production') {
  globalForGame.gameManager = gameManager;
}