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
}

// Represents a real player in the game
export interface Player extends UserProfile {
  type: "REAL";
  isRegistered: boolean;
  score: number; // Player's accuracy score
  voteHistory: { matchId: string; correct: boolean; speed: number }[];
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

// Defines the structure for the overall in-memory game state
export interface GameState {
  cycleId: string;
  state: GameCycleState;
  registrationEnds: number;
  gameEnds: number;
  players: Map<number, Player>; // Map of fid -> Player
  bots: Map<number, Bot>; // Map of fid -> Bot (impersonating that fid)
  matches: Map<string, Match>; // Map of matchId -> Match
  leaderboard: LeaderboardEntry[];
}
