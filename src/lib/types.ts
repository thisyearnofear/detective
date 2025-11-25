// src/lib/types.ts

// Represents the overall state of a game cycle
export type GameCycleState = "REGISTRATION" | "LIVE" | "FINISHED";

// Represents the type of opponent a player can face
export type OpponentType = "REAL" | "BOT";

// Basic user information, aligned with Farcaster user data
export interface UserProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

// Represents an AI bot, including its training data
export interface Bot extends UserProfile {
  type: "BOT";
  originalAuthor: UserProfile; // The user the bot is impersonating
  recentCasts: any[]; // Raw cast data for context
  style: string; // Inferred writing style
  personality?: any; // Behavioral patterns - imported from botProactive.ts to avoid circular dependency
}

// Represents a real player in the game
export interface Player extends UserProfile {
  type: "REAL";
  isRegistered: boolean;
  score: number; // Player's accuracy score
  voteHistory: VoteRecord[];
  inactivityStrikes: number; // Track inactivity violations
  lastActiveTime: number;
}

// Represents a single vote record
export interface VoteRecord {
  matchId: string;
  correct: boolean;
  speed: number; // Time in ms from match start to final vote
  voteChanges: number; // Number of times vote was toggled
  forfeit?: boolean; // If match was forfeited due to inactivity
  opponentUsername?: string;
  opponentType?: "REAL" | "BOT";
  roundNumber?: number;
}

// Represents a single conversation match
export interface Match {
  id: string;
  player: Player;
  opponent: Player | Bot;
  startTime: number;
  endTime: number;
  messages: ChatMessage[];
  isVotingComplete: boolean;
  isFinished: boolean;

  // New fields for multi-chat support
  slotNumber: 1 | 2; // Which chat slot (1 or 2)
  roundNumber: number; // Which round (1-5 for 5-minute game)
  currentVote?: "REAL" | "BOT"; // Current toggle state
  voteHistory: VoteChange[]; // Track all vote changes
  voteLocked: boolean; // Locked when chat ends
  lastPlayerMessageTime: number; // For inactivity tracking
  typingIndicator?: TypingIndicator; // Bot typing state
}

// Typing indicator state for realistic bot behavior
export interface TypingIndicator {
  isTyping: boolean;
  startTime: number;
  endTime: number;
  hasPauses?: boolean;
}

// Tracks each vote change during a match
export interface VoteChange {
  vote: "REAL" | "BOT";
  timestamp: number;
}

// Represents a single message in a chat
export interface ChatMessage {
  id: string;
  sender: Pick<UserProfile, "fid" | "username">;
  text: string;
  timestamp: number;
}

// Represents a single entry on the leaderboard
export interface LeaderboardEntry {
  player: Pick<Player, "fid" | "username" | "displayName" | "pfpUrl">;
  accuracy: number;
  avgSpeed: number; // Average time to vote correctly
}

// Tracks a player's current game session
export interface PlayerGameSession {
  fid: number;
  activeMatches: Map<number, string>; // slot number -> match ID
  completedMatchIds: Set<string>; // All completed match IDs
  facedOpponents: Map<number, number>; // opponent fid -> times faced
  currentRound: number;
  nextRoundStartTime?: number;
}

// Defines the structure for the overall in-memory game state
export interface GameState {
  cycleId: string;
  state: GameCycleState;
  registrationEnds: number;
  gameEnds: number;
  players: Map<number, Player>; // Map of fid -> Player
  bots: Map<number, Bot>; // Map of fid -> Bot (impersonating that fid)
  matches: Map<string, Match>; // Map of matchId -> Match
  playerSessions: Map<number, PlayerGameSession>; // Map of fid -> session
  leaderboard: LeaderboardEntry[];

  // Game extension tracking
  extensionCount: number; // Number of times game was extended
  maxExtensions: number; // Maximum allowed extensions
  finishedAt?: number; // Timestamp when game finished (for cleanup grace period)

  // Game configuration
  config: GameConfig;
}

// Game configuration parameters
export interface GameConfig {
  gameDurationMs: number; // Total game duration (5 minutes = 300000)
  matchDurationMs: number; // Each match duration (1 minute = 60000)
  simultaneousMatches: number; // Number of concurrent chats (2)
  inactivityWarningMs: number; // Warning after this time (30000)
  inactivityForfeitMs: number; // Auto-forfeit after this time (45000)
  maxInactivityStrikes: number; // Max strikes before cooldown (3)
}
