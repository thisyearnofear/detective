/**
 * Conversation Context Management (Phase 2: Lite Memory)
 * 
 * Stores minimal cross-round context to help bots flow naturally and avoid repetition.
 * Redis-backed with graceful fallback if unavailable.
 * Non-blocking: fires-and-forgets on save operations.
 * 
 * IMPORTANT: Context is INFORMATIONAL ONLY - not deterministic.
 * Bots use it as reference/suggestion in Venice prompt, but can ignore.
 * Zero impact on game state or round synchronization.
 */

import { redis, getJSON, setJSON } from "./redis";
import { ChatMessage } from "./types";

// TTL: 24 hours (covers entire game cycle + some)
const CONTEXT_TTL = 24 * 60 * 60;

/**
 * Minimal context to track across rounds
 */
export interface ConversationContextData {
  matchId: string;
  playerFid: number;
  botFid: number;
  roundNumber: number;
  cycleId: string;
  
  // What was discussed in previous rounds
  topicsDiscussed: string[];
  
  // How the player communicates (extracted from their messages)
  playerCommunicationStyle: "terse" | "conversational" | "verbose";
  playerEmotionalTone: "positive" | "neutral" | "critical" | "sarcastic";
  
  // Key phrases the player used
  playerKeyPhrases: string[];
  
  // Timestamp for tracking
  lastUpdatedAt: number;
}

/**
 * Build Redis key for conversation context
 * Format: conversation:{playerFid}:{botFid}
 * Allows tracking context per player-bot pair across multiple rounds
 */
function getContextKey(playerFid: number, botFid: number): string {
  return `conversation:${playerFid}:${botFid}`;
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
