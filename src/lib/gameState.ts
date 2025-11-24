/**
 * In-memory game state store
 * Holds all game data without database
 * Structure:
 * - users: Map of FID -> User profiles
 * - games: Map of game ID -> Game state
 * - matches: Map of match ID -> Match data
 * - messages: Map of match ID -> Message array
 */

export interface User {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  recentCasts: string[];
  neynarScore: number;
  createdAt: Date;
}

export interface UserProfile {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  recentCasts: string[];
}

export interface Match {
  id: string;
  gameId: string;
  player1Fid: number;
  player2FidOrBot: number | 'BOT';
  isPlayer2Bot: boolean;
  botPersonaUsername?: string;
  startedAt: Date;
  endedAt?: Date;
  messages: Message[];
  votes: Map<number, Vote>; // FID -> Vote
}

export interface Message {
  matchId: string;
  senderFid: number | 'BOT';
  senderUsername: string;
  content: string;
  timestamp: Date;
  isBot: boolean;
}

export interface Vote {
  voterFid: number;
  guess: 'REAL' | 'BOT';
  isCorrect: boolean;
  timestamp: Date;
}

export interface GameCycle {
  id: string;
  name: string;
  registrationOpenAt: Date;
  registrationCloseAt: Date;
  startTime: Date;
  endTime: Date;
  maxPlayers: number;
  registeredUsers: Map<number, User>; // FID -> User
  currentMatches: Map<string, Match>; // matchId -> Match
  matchedPlayers: Set<number>; // FIDs already matched in current round
  completedMatches: Match[];
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  correctGuesses: number;
  totalGuesses: number;
  accuracy: number;
  rank: number;
}

// Global state
const gameState = {
  users: new Map<number, User>(),
  activeCycle: null as GameCycle | null,
};

/**
 * Create a new game cycle
 */
export function createGameCycle(
  name: string,
  registrationOpenAt: Date,
  registrationCloseAt: Date,
  startTime: Date,
  endTime: Date,
  maxPlayers = 50
): GameCycle {
  return {
    id: `cycle_${Date.now()}`,
    name,
    registrationOpenAt,
    registrationCloseAt,
    startTime,
    endTime,
    maxPlayers,
    registeredUsers: new Map(),
    currentMatches: new Map(),
    matchedPlayers: new Set(),
    completedMatches: [],
    leaderboard: [],
  };
}

/**
 * Register a user for the active game cycle
 */
export function registerUserForGame(
  cycle: GameCycle,
  user: User
): { success: boolean; message: string } {
  // Check if game is in registration phase
  const now = new Date();
  if (now < cycle.registrationOpenAt || now > cycle.registrationCloseAt) {
    return { success: false, message: 'Registration is not open' };
  }

  // Check if user already registered
  if (cycle.registeredUsers.has(user.fid)) {
    return { success: false, message: 'User already registered' };
  }

  // Check if we've hit max players
  if (cycle.registeredUsers.size >= cycle.maxPlayers) {
    return { success: false, message: `Game is full (max ${cycle.maxPlayers} players)` };
  }

  // Register user
  cycle.registeredUsers.set(user.fid, user);
  gameState.users.set(user.fid, user);

  return { success: true, message: 'Successfully registered' };
}

/**
 * Create a new match between two players or a player and bot
 */
export function createMatch(
  cycle: GameCycle,
  player1Fid: number,
  player2FidOrBot: number | 'BOT',
  botPersonaUsername?: string
): Match {
  const isBot = player2FidOrBot === 'BOT';

  return {
    id: `match_${Date.now()}_${Math.random()}`,
    gameId: cycle.id,
    player1Fid,
    player2FidOrBot,
    isPlayer2Bot: isBot,
    botPersonaUsername,
    startedAt: new Date(),
    messages: [],
    votes: new Map(),
  };
}

/**
 * Add message to match
 */
export function addMessageToMatch(
  match: Match,
  senderFid: number | 'BOT',
  senderUsername: string,
  content: string,
  isBot = false
): void {
  match.messages.push({
    matchId: match.id,
    senderFid,
    senderUsername,
    content,
    timestamp: new Date(),
    isBot,
  });
}

/**
 * Submit a vote in a match
 */
export function submitVote(
  match: Match,
  voterFid: number,
  guess: 'REAL' | 'BOT'
): void {
  const isCorrect =
    guess === 'BOT' ? match.isPlayer2Bot : !match.isPlayer2Bot;

  match.votes.set(voterFid, {
    voterFid,
    guess,
    isCorrect,
    timestamp: new Date(),
  });
}

/**
 * Calculate leaderboard for a game cycle
 */
export function calculateLeaderboard(cycle: GameCycle): LeaderboardEntry[] {
  const scoreMap = new Map<
    number,
    { correct: number; total: number; fid: number; user: User }
  >();

  // Aggregate votes
  cycle.completedMatches.forEach((match) => {
    match.votes.forEach((vote, fid) => {
      if (!scoreMap.has(fid)) {
        scoreMap.set(fid, {
          fid,
          correct: 0,
          total: 0,
          user: cycle.registeredUsers.get(fid)!,
        });
      }

      const entry = scoreMap.get(fid)!;
      entry.total++;
      if (vote.isCorrect) entry.correct++;
    });
  });

  // Convert to leaderboard
  const leaderboard = Array.from(scoreMap.values())
    .map((entry) => ({
      fid: entry.fid,
      username: entry.user.username,
      displayName: entry.user.displayName,
      pfpUrl: entry.user.pfpUrl,
      correctGuesses: entry.correct,
      totalGuesses: entry.total,
      accuracy: entry.total > 0 ? (entry.correct / entry.total) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => {
      // Sort by accuracy, then by speed (timestamp)
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      return 0;
    });

  // Add ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}

/**
 * Get the current game state (for debugging/inspection)
 */
export function getGameState() {
  return gameState;
}

/**
 * Set active game cycle
 */
export function setActiveCycle(cycle: GameCycle | null) {
  gameState.activeCycle = cycle;
}

/**
 * Get active game cycle
 */
export function getActiveCycle(): GameCycle | null {
  return gameState.activeCycle;
}
