/**
 * Investigator Memory (durable curiosity-engine memory)
 *
 * Stores cross-session context so persons remember investigators.
 * Redis hot path + Postgres mirror (survives Redis TTL wipe).
 *
 * IMPORTANT: Context is INFORMATIONAL ONLY - not deterministic.
 * Zero impact on game state or round synchronization.
 */

import { redis, getJSON, setJSON } from "./redis";
import { ChatMessage } from "./types";
import { saveInvestigatorMemory as persistMemoryToPg, loadInvestigatorMemory as loadMemoryFromPg } from "./caseRepository";

// Redis TTL: 30 days (Postgres is the durable SoT)
const MEMORY_TTL = 30 * 24 * 60 * 60;
const CONTEXT_TTL = 24 * 60 * 60;

/**
 * Temporal investigator↔person memory
 */
export interface InvestigatorMemory {
  investigatorFid: number;
  personFid: number;

  topicThreads: Array<{
    topic: string;
    mentions: number;
    firstRound: number;
    lastRound: number;
  }>;

  topicAffinities: Record<string, number>;
  coherencePatterns: Record<string, number>;

  playerCommunicationStyle: "terse" | "conversational" | "verbose";
  playerEmotionalTone: "positive" | "neutral" | "critical" | "sarcastic";
  playerKeyPhrases: string[];

  lastUpdatedAt: number;
}

/** @deprecated Use InvestigatorMemory */
export type ConversationMemory = InvestigatorMemory;

/**
 * Legacy ConversationContextData kept for backward compatibility
 */
export interface ConversationContextData {
  matchId: string;
  playerFid: number;
  botFid: number;
  roundNumber: number;
  cycleId: string;

  topicsDiscussed: string[];
  playerCommunicationStyle: "terse" | "conversational" | "verbose";
  playerEmotionalTone: "positive" | "neutral" | "critical" | "sarcastic";
  playerKeyPhrases: string[];
  lastUpdatedAt: number;
}

/**
 * Build Redis keys for conversation context
 */
function getContextKey(playerFid: number, botFid: number): string {
  return `conversation:${playerFid}:${botFid}`;
}

function getMemoryKey(investigatorFid: number, personFid: number): string {
  return `memory:${investigatorFid}:${personFid}`;
}

/**
 * Extract topics from a message (very simple)
 * Real implementation would be more sophisticated
 */
function extractTopics(message: string): string[] {
  const topics: string[] = [];
  
  const topicPatterns = [
    { pattern: /crypto|bitcoin|eth|token|blockchain|web3|defi/gi, topic: "crypto" },
    { pattern: /farcaster|warpcast|social|protocol/gi, topic: "social" },
    { pattern: /tech|code|build|deploy|ship/gi, topic: "tech" },
    { pattern: /moon|lfg|bullish|bearish|market|price/gi, topic: "market" },
    { pattern: /life|work|job|grind|hustle/gi, topic: "work" },
    { pattern: /fun|lol|haha|joke|meme/gi, topic: "humor" },
  ];
  
  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(message)) {
      topics.push(topic);
    }
  }
  
  return topics;
}

/**
 * Infer player's communication style from their messages
 */
function inferPlayerStyle(messages: ChatMessage[], playerFid: number): "terse" | "conversational" | "verbose" {
  const playerMessages = messages.filter(m => m.sender.fid === playerFid);
  
  if (playerMessages.length === 0) return "conversational";
  
  const totalLength = playerMessages.reduce((sum, m) => sum + m.text.length, 0);
  const avgLength = totalLength / playerMessages.length;
  
  if (avgLength < 50) return "terse";
  if (avgLength > 150) return "verbose";
  return "conversational";
}

/**
 * Infer player's emotional tone from their messages
 */
function inferPlayerTone(messages: ChatMessage[], playerFid: number): "positive" | "neutral" | "critical" | "sarcastic" {
  const playerMessages = messages.filter(m => m.sender.fid === playerFid);
  
  if (playerMessages.length === 0) return "neutral";
  
  const textCombined = playerMessages.map(m => m.text).join(" ").toLowerCase();
  
  const positiveWords = /\b(great|awesome|love|amazing|good|cool|nice|bullish)\b/gi;
  const negativeWords = /\b(bad|terrible|hate|awful|bearish|trash|sucks)\b/gi;
  const sarcasticPatterns = /\b(sure|right|obviously|clearly|yeah right)\b/gi;
  
  const positiveCount = (textCombined.match(positiveWords) || []).length;
  const negativeCount = (textCombined.match(negativeWords) || []).length;
  const sarcasticCount = (textCombined.match(sarcasticPatterns) || []).length;
  
  if (sarcasticCount > Math.max(positiveCount, negativeCount)) return "sarcastic";
  if (negativeCount > positiveCount) return "critical";
  if (positiveCount > negativeCount) return "positive";
  return "neutral";
}

/**
 * Extract key phrases from player's messages
 */
function extractPlayerPhrases(messages: ChatMessage[], playerFid: number): string[] {
  const playerMessages = messages.filter(m => m.sender.fid === playerFid);
  const phraseMap: Record<string, number> = {};
  
  playerMessages.forEach(msg => {
    const words = msg.text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (phrase.length > 5 && !phrase.includes("http")) {
        phraseMap[phrase] = (phraseMap[phrase] || 0) + 1;
      }
    }
  });
  
  return Object.entries(phraseMap)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

/**
 * Load temporal memory for an investigator↔person pair.
 * Redis first; Postgres fallback when Redis is cold.
 */
export async function loadConversationMemory(
  investigatorFid: number,
  personFid: number,
): Promise<InvestigatorMemory | null> {
  try {
    const key = getMemoryKey(investigatorFid, personFid);
    const memory = await getJSON<InvestigatorMemory>(key);
    if (memory) {
      // Normalize legacy field names if present
      if ((memory as any).playerFid != null && memory.investigatorFid == null) {
        memory.investigatorFid = (memory as any).playerFid;
        memory.personFid = (memory as any).botFid;
      }
      return memory;
    }

    const fromPg = await loadMemoryFromPg(investigatorFid, personFid);
    if (fromPg && typeof fromPg === "object") {
      const restored = fromPg as unknown as InvestigatorMemory;
      await setJSON(key, restored, MEMORY_TTL);
      return restored;
    }
    return null;
  } catch (error) {
    console.warn(`[conversationContext] Failed to load memory for ${investigatorFid}/${personFid}:`, error);
    return null;
  }
}

/**
 * Enrich prompt with temporal memory insights
 */
export function enrichPromptWithMemory(memory: InvestigatorMemory | null): string {
  if (!memory) return "";

  const lines: string[] = [];

  const topTopics = Object.entries(memory.topicAffinities || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, score]) => `${topic} (${Math.round(score * 100)}% coherent)`)
    .join(", ");

  if (topTopics) {
    lines.push(`\nUSER INTERESTS: ${topTopics}`);
  }

  const topPatterns = Object.entries(memory.coherencePatterns || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (topPatterns.length > 0) {
    const patterns = topPatterns
      .map(([pattern, score]) => `${pattern} (${Math.round(score * 100)}% works)`)
      .join(", ");
    lines.push(`\nPROVEN RESPONSE PATTERNS: ${patterns}`);
  }

  return lines.join("\n");
}

/**
 * Load context for a player-bot pair (if it exists)
 * Returns null if not found or Redis unavailable
 */
export async function loadConversationContext(
  playerFid: number,
  botFid: number,
): Promise<ConversationContextData | null> {
  try {
    const key = getContextKey(playerFid, botFid);
    const context = await getJSON<ConversationContextData>(key);
    return context || null;
  } catch (error) {
    // Redis unavailable or error - gracefully return null
    // Bots continue to work without context
    console.warn(`[conversationContext] Failed to load context for ${playerFid}/${botFid}:`, error);
    return null;
  }
}

/**
 * Save or update context for a player-bot pair
 * Non-blocking: doesn't await
 */
export async function saveConversationContext(
  playerFid: number,
  botFid: number,
  roundNumber: number,
  cycleId: string,
  messages: ChatMessage[],
): Promise<void> {
  try {
    // Collect all topics discussed in this round
    const topicsThisRound = messages
      .flatMap(m => extractTopics(m.text))
      .filter((topic, index, arr) => arr.indexOf(topic) === index); // unique
    
    const key = getContextKey(playerFid, botFid);
    const previousContext = await getJSON<ConversationContextData>(key);
    
    // Merge with previous context (accumulate topics over rounds)
    const allTopics = previousContext?.topicsDiscussed || [];
    topicsThisRound.forEach(topic => {
      if (!allTopics.includes(topic)) {
        allTopics.push(topic);
      }
    });
    
    const context: ConversationContextData = {
      matchId: `round-${roundNumber}`,
      playerFid,
      botFid,
      roundNumber,
      cycleId,
      topicsDiscussed: allTopics.slice(0, 10), // Keep last 10 topics
      playerCommunicationStyle: inferPlayerStyle(messages, playerFid),
      playerEmotionalTone: inferPlayerTone(messages, playerFid),
      playerKeyPhrases: extractPlayerPhrases(messages, playerFid),
      lastUpdatedAt: Date.now(),
    };
    
    await setJSON(key, context, CONTEXT_TTL);
    console.log(`[conversationContext] Saved context for ${playerFid}/${botFid}, topics: ${allTopics.join(", ")}`);
  } catch (error) {
    // Non-blocking: silently fail if Redis unavailable
    // Game continues without context memory
    console.warn(`[conversationContext] Failed to save context:`, error);
  }
}

/**
 * Format context as a readable string for Venice prompt
 * Used as background/reference information only
 */
export function formatContextForPrompt(context: ConversationContextData | null): string {
  if (!context) {
    return "";
  }
  
  const lines = [
    `BACKGROUND CONTEXT (from previous rounds):`,
    `- Topics discussed: ${context.topicsDiscussed.join(", ") || "general chat"}`,
    `- Player style: ${context.playerCommunicationStyle}`,
    `- Player tone: ${context.playerEmotionalTone}`,
  ];
  
  if (context.playerKeyPhrases.length > 0) {
    lines.push(`- Player's phrases: ${context.playerKeyPhrases.join(", ")}`);
  }
  
  return lines.join("\n");
}

/**
 * Build and save investigator memory from a round of conversation.
 * Dual-writes Redis (hot) + Postgres (durable).
 */
export async function saveConversationMemory(
  investigatorFid: number,
  personFid: number,
  messages: ChatMessage[],
  coherenceScores?: Array<{ type: string; score: number }>,
): Promise<void> {
  try {
    const key = getMemoryKey(investigatorFid, personFid);
    let existingMemory = await getJSON<InvestigatorMemory>(key);
    if (!existingMemory) {
      const fromPg = await loadMemoryFromPg(investigatorFid, personFid);
      if (fromPg) existingMemory = fromPg as unknown as InvestigatorMemory;
    }

    const topicsThisRound = messages
      .flatMap((m) => extractTopics(m.text))
      .filter((topic, index, arr) => arr.indexOf(topic) === index);

    const topicThreads: InvestigatorMemory["topicThreads"] =
      existingMemory?.topicThreads || [];
    topicsThisRound.forEach((topic) => {
      const existing = topicThreads.find((t) => t.topic === topic);
      if (existing) {
        existing.mentions++;
        existing.lastRound = Date.now();
      } else {
        topicThreads.push({
          topic,
          mentions: 1,
          firstRound: Date.now(),
          lastRound: Date.now(),
        });
      }
    });

    const topicAffinities = existingMemory?.topicAffinities || {};
    topicsThisRound.forEach((topic) => {
      if (!topicAffinities[topic]) topicAffinities[topic] = 0.5;
      const avgCoherence =
        coherenceScores && coherenceScores.length > 0
          ? coherenceScores.reduce((sum, s) => sum + s.score, 0) /
            coherenceScores.length
          : 0.85;
      topicAffinities[topic] = topicAffinities[topic] * 0.7 + avgCoherence * 0.3;
    });

    const coherencePatterns = existingMemory?.coherencePatterns || {};
    if (coherenceScores && coherenceScores.length > 0) {
      coherenceScores.forEach(({ type, score }) => {
        if (!coherencePatterns[type]) coherencePatterns[type] = 0.5;
        coherencePatterns[type] = coherencePatterns[type] * 0.6 + score * 0.4;
      });
    }

    const memory: InvestigatorMemory = {
      investigatorFid,
      personFid,
      topicThreads: topicThreads.slice(-10),
      topicAffinities,
      coherencePatterns,
      playerCommunicationStyle: inferPlayerStyle(messages, investigatorFid),
      playerEmotionalTone: inferPlayerTone(messages, investigatorFid),
      playerKeyPhrases: extractPlayerPhrases(messages, investigatorFid),
      lastUpdatedAt: Date.now(),
    };

    await setJSON(key, memory, MEMORY_TTL);
    persistMemoryToPg(investigatorFid, personFid, memory as unknown as Record<string, unknown>).catch(
      (err) => console.warn(`[investigatorMemory] Postgres mirror failed:`, err),
    );
    console.log(
      `[investigatorMemory] Saved for ${investigatorFid}/${personFid}, topics: ${Object.keys(topicAffinities).slice(0, 3).join(", ")}`,
    );
  } catch (error) {
    console.warn(`[investigatorMemory] Failed to save:`, error);
  }
}

/**
 * Clear all conversation context (for admin/testing)
 */
export async function clearAllConversationContexts(): Promise<void> {
  try {
    const keys = await redis.keys("conversation:*");
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[conversationContext] Cleared ${keys.length} contexts`);
    }
  } catch (error) {
    console.warn(`[conversationContext] Failed to clear contexts:`, error);
  }
}
