// src/lib/gamification.ts
// Lightweight end-of-game feedback helpers (accuracy / streak / share)

export interface GameResult {
  accuracy: number;
  rank: number;
  totalPlayers: number;
  correctCount: number;
  totalCount: number;
  earnings: number;
  streak: number;
  roundResults: Array<{
    opponentType: "REAL" | "BOT";
    correct: boolean;
    stakedAmount?: string;
    payoutAmount?: string;
  }>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (result: GameResult) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "master_detective",
    name: "Master Detective",
    description: "Achieve 80%+ accuracy",
    icon: "🕵️",
    condition: (r) => r.accuracy >= 80,
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "Get 100% accuracy",
    icon: "🎯",
    condition: (r) => r.accuracy === 100,
  },
  {
    id: "top_3",
    name: "Top 3",
    description: "Finish in the top 3",
    icon: "🥇",
    condition: (r) => r.rank <= 3,
  },
  {
    id: "hot_streak",
    name: "Hot Streak",
    description: "Win 3+ matches in a row",
    icon: "🔥",
    condition: (r) => r.streak >= 3,
  },
];

export function getAchievements(result: GameResult): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.condition(result));
}

export function getMotivationMessage(accuracy: number): string {
  if (accuracy >= 90) return "Incredible detective work! You're a natural.";
  if (accuracy >= 75) return "Excellent work! The precinct is proud.";
  if (accuracy >= 60) return "Nice work! Keep playing to improve.";
  if (accuracy >= 40) return "Not bad! You'll get better with practice.";
  return "Keep trying - every detective starts somewhere.";
}

export function formatEarnings(arbAmount: number): string {
  if (arbAmount === 0) return "0 ARB";
  if (arbAmount < 0.001) return "<0.001 ARB";
  return `+${arbAmount.toFixed(4)} ARB`;
}

export function calculateStreak(roundResults: GameResult["roundResults"]): number {
  let streak = 0;
  for (const result of roundResults) {
    if (result.correct) {
      streak++;
    } else {
      streak = 0;
    }
  }
  return streak;
}

export function calculateEarnings(roundResults: GameResult["roundResults"]): number {
  let total = 0;
  for (const result of roundResults) {
    if (result.payoutAmount) {
      total += Number(result.payoutAmount) / 1e18;
    }
  }
  return total;
}

export function generateShareText(result: GameResult, achievements: Achievement[]): string {
  const lines = [
    `Detective Case Closed!`,
    ``,
    `Accuracy: ${result.accuracy.toFixed(0)}%`,
    `Rank: #${result.rank} of ${result.totalPlayers}`,
    `Streak: ${result.streak}`,
    ``,
  ];

  if (achievements.length > 0) {
    lines.push(`Achievements:`);
    lines.push(achievements.map((a) => `${a.icon} ${a.name}`).join(", "));
  }

  lines.push(``, `Play at detective.proof.org`);
  return lines.join("\n");
}
