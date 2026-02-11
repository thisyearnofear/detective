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
  address?: string; // Linked Arbitrum/ETH wallet address
}

// Represents an AI bot, including its training data
export interface Bot extends UserProfile {
  type: "BOT";
  originalAuthor: UserProfile; // The user the bot is impersonating
  recentCasts: any[]; // Raw cast data for context
  style: string; // Inferred writing style
  personality?: any; // Complete behavioral + linguistic patterns from botProactive.ts
  isExternal?: boolean; // If true, native inference is skipped and an external agent must reply
  controllerAddress?: string; // ETH address authorized to speak for this bot

  // Multi-LLM Support (OpenRouter)
  llmModelId?: string; // The LLM model ID used to generate responses
  llmModelName?: string; // Human-readable name like "Claude Sonnet 4"
  llmProvider?: string; // Provider like "Anthropic", "OpenAI", etc.
}

// Represents a real player in the game
export interface Player extends UserProfile {
  type: "REAL";
  isRegistered: boolean;
  isReady: boolean;
  score: number; // Player's accuracy score
  voteHistory: VoteRecord[];
  inactivityStrikes: number; // Track inactivity violations
  lastActiveTime: number;
  
  // ERC-7715 & Staking
  hasPermission?: boolean; // If they've granted ERC-7715 session permissions
  permissionExpiry?: number; // When the permission expires
  availableBalance?: string; // Provisional balance for the session (wei)
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
  
  // Economic Outcome
  stakedAmount?: string; // Amount staked in base units
  stakeCurrency?: "NATIVE" | "USDC"; // Currency used for stake
  payoutAmount?: string; // Amount won/lost in base units
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

  // Truth Stake (supports native ETH/ARB and USDC)
  stakedAmount?: string; // Amount staked in base units
  stakeCurrency?: "NATIVE" | "USDC"; // Currency used for stake
  isStaked?: boolean; // Whether this match has active economic stakes
  payoutStatus?: "PENDING" | "SETTLED" | "FAILED";
  stakeTxHash?: string; // On-chain stake transaction hash
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
  currentRound: number; // Synchronized with game timer (not event-based)
}

// Defines the structure for the overall in-memory game state
export interface GameState {
  cycleId: string;
  state: GameCycleState;
  registrationEnds: number;
  gameEnds: number;
  gameStartTime?: number; // Timestamp when LIVE state began (for synchronized round timing)
  players: Map<number, Player>; // Map of fid -> Player
  bots: Map<number, Bot>; // Map of fid -> Bot (impersonating that fid)
  matches: Map<string, Match>; // Map of matchId -> Match
  playerSessions: Map<number, PlayerGameSession>; // Map of fid -> session
  leaderboard: LeaderboardEntry[];
  finishedAt?: number; // Timestamp when game finished

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
  monetizationEnabled: boolean; // Toggles Truth Stake loop and ERC-7715 (monetization)
}
