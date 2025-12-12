// src/lib/inference.ts
import { Bot, ChatMessage } from "./types";
import {
  addImperfections,
  shouldUseEmojis,
  addEmojis,
  shouldAddRedHerring,
  applyRedHerring,
  extractUserIntent,
  ConversationState,
  initializeConversationState,
  scoreCoherence,
  recordBotClaim,
  recordCoherenceScore,
} from "./botBehavior";
import {
  loadConversationContext,
  formatContextForPrompt,
  loadConversationMemory,
  enrichPromptWithMemory,
} from "./conversationContext";

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_MODEL = "llama-3.3-70b";

// Conversation state tracking per match (matchId -> ConversationState)
const conversationStateCache = new Map<string, ConversationState>();

export function getOrInitializeConversationState(
  matchId: string,
): ConversationState {
  if (!conversationStateCache.has(matchId)) {
    conversationStateCache.set(matchId, initializeConversationState());
  }
  return conversationStateCache.get(matchId)!;
}

/**
 * Extract coherence scores from a completed match for memory saving
 */
export function extractCoherenceScoresFromMatch(matchId: string): Array<{ type: string; score: number }> {
  const state = conversationStateCache.get(matchId);
  if (!state || !state.coherenceScores) {
    return [];
  }
  return state.coherenceScores.map(({ type, score }) => ({ type, score }));
}

/**
 * Clear conversation state for a match (cleanup after round complete)
 */
export function clearConversationState(matchId: string): void {
  conversationStateCache.delete(matchId);
}

/**
 * Infers the writing style of a user based on their recent casts.
 */
export async function inferWritingStyle(casts: string[]): Promise<string> {
  if (casts.length === 0) {
    return "generic conversationalist";
  }

  // Analyze patterns
  const totalLength = casts.reduce((sum, cast) => sum + cast.length, 0);
  const avgLength = Math.floor(totalLength / casts.length);

  // Check for emoji usage
  const emojiCount = casts.filter((cast) =>
    /[\u{1F300}-\u{1F9FF}]/u.test(cast),
  ).length;
  const usesEmojis = emojiCount / casts.length > 0.2;

  // Check capitalization patterns
  const properCaps = casts.filter((cast) => /^[A-Z]/.test(cast)).length;
  const usesProperCaps = properCaps / casts.length > 0.7;

  // Check punctuation
  const properPunct = casts.filter((cast) => /[.!?]$/.test(cast)).length;
  const usesPunctuation = properPunct / casts.length > 0.6;

  // Build style string with metadata
  let style = "";

  if (avgLength < 50) {
    style = "brief and concise";
  } else if (avgLength < 150) {
    style = "conversational";
  } else {
    style = "detailed and thoughtful";
  }

  // Add metadata
  style += ` | avg_length:${avgLength}`;
  style += ` | emojis:${usesEmojis}`;
  style += ` | caps:${usesProperCaps}`;
  style += ` | punct:${usesPunctuation}`;

  // Check for specific patterns
  const commonWords = extractCommonWords(casts);
  if (commonWords.includes("gm") || commonWords.includes("gn")) {
    style += " | greeting-friendly";
  }

  if (commonWords.includes("ser") || commonWords.includes("fren")) {
    style += " | crypto-native";
  }

  if (commonWords.includes("lol") || commonWords.includes("lmao")) {
    style += " | humor";
  }

  return style;
}

/**
 * Extract actual short/medium/long responses from cast history
 * Returns the user's own words, not generic phrases
 */
function extractActualResponses(
  casts: Array<{ text: string }>,
  lengthCategory: "short" | "medium" | "long"
): string[] {
  const responses: string[] = [];

  casts.forEach((cast) => {
    const text = cast.text.trim();
    if (!text) return;

    const charCount = text.length;
    let matches = false;

    if (lengthCategory === "short" && charCount < 50) {
      matches = true;
    } else if (lengthCategory === "medium" && charCount >= 50 && charCount < 150) {
      matches = true;
    } else if (lengthCategory === "long" && charCount >= 150) {
      matches = true;
    }

    if (matches && !text.includes("http") && !text.includes("@")) {
      // Skip URLs and mentions-heavy posts
      responses.push(text);
    }
  });

  return responses;
}

/**
 * Generate a fallback response from actual cast history
 * This is the ground truth - real examples of how they talk
 * ENHANCEMENT: Single source of truth for cast-based fallback
 */
function generateFallbackResponse(
  lengthDistribution: {
    dominantPattern: "short" | "medium" | "long" | "mixed";
    avgLength: number;
  },
  recentCasts: Array<{ text: string }>,
): string {
  // Determine which length pool to draw from
  const lengthCategory = lengthDistribution.dominantPattern === "mixed"
    ? (Math.random() < 0.5 ? "short" : "medium")
    : lengthDistribution.dominantPattern;

  // Extract actual responses from their cast history
  const actualResponses = extractActualResponses(recentCasts, lengthCategory);

  // If we have actual responses from their history, use one
  if (actualResponses.length > 0) {
    return actualResponses[Math.floor(Math.random() * actualResponses.length)];
  }

  // Fallback to other length categories if we don't have matches
  const otherLengths: ("short" | "medium" | "long")[] = ["short", "medium", "long"].filter(
    (len) => len !== lengthCategory
  ) as ("short" | "medium" | "long")[];

  for (const fallbackLength of otherLengths) {
    const fallbackResponses = extractActualResponses(recentCasts, fallbackLength);
    if (fallbackResponses.length > 0) {
      return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
  }

  // Last resort: return their shortest cast (authentically theirs)
  if (recentCasts.length > 0) {
    const shortest = recentCasts.reduce((prev, curr) =>
      curr.text.length < prev.text.length ? curr : prev
    );
    return shortest.text;
  }

  // Ultimate fallback if no casts available
  return "hmm";
}

/**
 * Single source of truth for Venice API calls
 * CLEAN: Encapsulates API interaction, temperature control, token limits
 * DRY: Reusable for both initial generation and regeneration attempts
 */
async function callVeniceAPI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number = 0.55,
): Promise<{ content: string; error?: string }> {
  try {
    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { content: "", error: `API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      return { content: "", error: "Empty response from API" };
    }

    return { content };
  } catch (error: any) {
    const errorMsg = error.name === 'TimeoutError' || error.name === 'AbortError'
      ? "Request timeout"
      : error.message;
    return { content: "", error: errorMsg };
  }
}

/**
 * Regenerate response with tighter constraints after coherence failure
 * MODULAR: Separate retry logic with stricter guidance
 * Only used when initial generation fails coherence checks (0.3-0.5 range)
 */
async function regenerateWithTighterConstraints(
  bot: Bot,
  messageHistory: ChatMessage[],
  lengthDistribution: ReturnType<typeof analyzePostLengthDistribution>,
  recentPosts: string[],
  maxTokens: number,
): Promise<{ content: string; error?: string }> {
  const lastUserMessage = messageHistory[messageHistory.length - 1]?.text || "hello";

  // Build STRICT regeneration prompt - focus on cast authenticity
  const tightPrompt = `You are @${bot.username}. CRITICAL: respond EXACTLY like their actual posts. NO GENERIC PHRASES.

THEIR REAL VOICE (study these):
${recentPosts.slice(0, 5).map((p) => `"${p}"`).join("\n")}

RULES (STRICT):
✓ Use ONLY phrases from their posts
✓ NO AI language ("interesting", "appreciate", "seems like")
✓ Match their typical length: ${lengthDistribution.dominantPattern}
✓ Sound spontaneous and raw

Answer naturally in their style:`;

  return callVeniceAPI(
    tightPrompt,
    lastUserMessage,
    Math.floor(maxTokens * 0.8), // Slightly smaller window for tighter response
    0.45, // Lower temperature for more constrained generation
  );
}

/**
 * Extract common words and phrases from casts
 */
function extractCommonWords(casts: string[]): string[] {
  const wordFrequency: Record<string, number> = {};

  casts.forEach((cast) => {
    const words = cast.toLowerCase().split(/\s+/);
    words.forEach((word) => {
      // Skip very common words
      if (
        word.length > 2 &&
        !["the", "and", "for", "are", "but", "was", "will", "with"].includes(
          word,
        )
      ) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });

  // Return words that appear in at least 10% of casts
  const minFrequency = Math.max(2, casts.length * 0.1);
  return Object.entries(wordFrequency)
    .filter(([_, count]) => count >= minFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Extract common phrases from recent posts
 */
function extractCommonPhrases(posts: string[]): string[] {
  const phrases: string[] = [];
  const phraseCounts: Record<string, number> = {};

  posts.forEach((post) => {
    // Extract 2-3 word phrases
    const words = post.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const twoWord = `${words[i]} ${words[i + 1]}`;
      phraseCounts[twoWord] = (phraseCounts[twoWord] || 0) + 1;

      if (i < words.length - 2) {
        const threeWord = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        phraseCounts[threeWord] = (phraseCounts[threeWord] || 0) + 1;
      }
    }
  });

  // Return phrases that appear multiple times
  Object.entries(phraseCounts)
    .filter(([phrase, count]) => count >= 2 && !phrase.includes("the "))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([phrase]) => phrases.push(phrase));

  return phrases;
}

/**
 * Analyze post length distribution to understand posting patterns
 */
function analyzePostLengthDistribution(posts: string[]): {
  shortPosts: string[];
  mediumPosts: string[];
  longPosts: string[];
  avgLength: number;
  shortPercentage: number;
  mediumPercentage: number;
  longPercentage: number;
  dominantPattern: "short" | "medium" | "long" | "mixed";
} {
  const shortPosts = posts.filter((p) => p.length < 50);
  const mediumPosts = posts.filter((p) => p.length >= 50 && p.length < 150);
  const longPosts = posts.filter((p) => p.length >= 150);

  const totalLength = posts.reduce((sum, p) => sum + p.length, 0);
  const avgLength = posts.length > 0 ? Math.floor(totalLength / posts.length) : 0;

  const shortPercentage = (shortPosts.length / posts.length) * 100;
  const mediumPercentage = (mediumPosts.length / posts.length) * 100;
  const longPercentage = (longPosts.length / posts.length) * 100;

  // Determine dominant pattern
  let dominantPattern: "short" | "medium" | "long" | "mixed";
  if (shortPercentage > 50) {
    dominantPattern = "short";
  } else if (longPercentage > 50) {
    dominantPattern = "long";
  } else if (mediumPercentage > 50) {
    dominantPattern = "medium";
  } else {
    dominantPattern = "mixed";
  }

  return {
    shortPosts,
    mediumPosts,
    longPosts,
    avgLength,
    shortPercentage,
    mediumPercentage,
    longPercentage,
    dominantPattern,
  };
}

/**
 * Analyze conversation context to make responses more dynamic
 */
function analyzeConversationContext(messageHistory: ChatMessage[], botFid: number): {
  hasUserAskedQuestion: boolean;
  botRecentResponses: string[];
  hasRepeatedPhrase: boolean;
  repeatedPhrase: string | null;
  messagesSinceBotSpoke: number;
  conversationDominatedByUser: boolean;
} {
  const userMessages = messageHistory.filter(msg => msg.sender.fid !== botFid);
  const botMessages = messageHistory.filter(msg => msg.sender.fid === botFid);

  // Check if user asked a question recently
  const lastUserMessage = userMessages[userMessages.length - 1]?.text || "";
  const hasUserAskedQuestion = lastUserMessage.includes("?") ||
    lastUserMessage.toLowerCase().startsWith("why") ||
    lastUserMessage.toLowerCase().startsWith("what") ||
    lastUserMessage.toLowerCase().startsWith("how") ||
    lastUserMessage.toLowerCase().startsWith("when") ||
    lastUserMessage.toLowerCase().startsWith("where") ||
    lastUserMessage.toLowerCase().startsWith("who");

  // Get bot's last 3 responses
  const botRecentResponses = botMessages.slice(-3).map(msg => msg.text.toLowerCase().trim());

  // Check for repetition
  const uniqueRecent = new Set(botRecentResponses);
  const hasRepeatedPhrase = uniqueRecent.size < botRecentResponses.length;
  const repeatedPhrase = hasRepeatedPhrase ?
    botRecentResponses.find((r, i) => botRecentResponses.indexOf(r) !== i) || null :
    null;

  // Count messages since bot last spoke
  let messagesSinceBotSpoke = 0;
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    if (messageHistory[i].sender.fid === botFid) break;
    messagesSinceBotSpoke++;
  }

  // Check if conversation is dominated by user
  const conversationDominatedByUser = userMessages.length > botMessages.length + 2;

  return {
    hasUserAskedQuestion,
    botRecentResponses,
    hasRepeatedPhrase,
    repeatedPhrase,
    messagesSinceBotSpoke,
    conversationDominatedByUser,
  };
}

/**
 * Build a comprehensive system prompt based on bot personality, coherence requirements, and conversation context.
 * SINGLE SOURCE OF TRUTH for prompt construction - centralizes all guidance into one place.
 * Returns both prompt and metadata for downstream processing.
 */
function buildSystemPrompt(
  bot: Bot,
  messageHistory: ChatMessage[],
  lengthDistribution: ReturnType<typeof analyzePostLengthDistribution>,
  recentPosts: string[],
  commonPhrases: string[],
  conversationContextString: string,
): {
  prompt: string;
  metadata: Record<string, string>;
  baseStyle: string;
} {
  // Extract style metadata
  const styleData = bot.style.split(" | ");
  const baseStyle = styleData[0];
  const metadata = styleData.slice(1).reduce(
    (acc, item) => {
      const [key, value] = item.split(":");
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  // Format conversation history
  const conversationContext = messageHistory
    .slice(-12)
    .map((msg) => `${msg.sender.username}: ${msg.text}`)
    .join("\n");

  // Extract user intent
  const userIntent = extractUserIntent(messageHistory);
  const convContext = analyzeConversationContext(messageHistory, bot.fid);

  // Determine length guidance
  let lengthGuidance = "under 50 characters";
  if (lengthDistribution.dominantPattern === "short") {
    lengthGuidance = "very short (under 50 chars), like they usually write";
  } else if (lengthDistribution.dominantPattern === "long") {
    lengthGuidance = "longer (100-150 chars), matching their typical style";
  } else if (lengthDistribution.dominantPattern === "medium") {
    lengthGuidance = "medium length (50-150 chars)";
  } else {
    const patterns = ["short (under 50 chars)", "medium (50-150 chars)", "longer (100-200 chars)"];
    lengthGuidance = patterns[Math.floor(Math.random() * patterns.length)];
  }

  // Build personality context sections
  let personalityContext = "";
  if (bot.personality) {
    const traits = [];
    if (bot.personality.initiatesConversations) traits.push("often starts conversations");
    if (bot.personality.asksQuestions) traits.push("asks questions frequently");
    if (bot.personality.isDebater) traits.push("opinionated/debater");
    if (traits.length > 0) {
      personalityContext = `\nCOMMUNICATION TRAITS: ${traits.join(", ")}`;
    }
  }

  // Build cast-derived patterns context
  let castingContext = "";
  if (bot.personality) {
    const personality = bot.personality;
    const contextLines = [];

    if (personality.frequentPhrases?.length > 0) {
      contextLines.push(`- Favorite phrases: ${personality.frequentPhrases.slice(0, 5).join(", ")}`);
    }
    if (personality.opinionMarkers?.length > 0) {
      contextLines.push(`- Uses opinion words: ${personality.opinionMarkers.slice(0, 5).join(", ")}`);
    }
    if (personality.theirGreetings?.length > 0) {
      contextLines.push(`- Greets with: ${personality.theirGreetings.slice(0, 3).join(", ")}`);
    }
    if (personality.emotionalTone && personality.emotionalTone !== "neutral") {
      contextLines.push(`- Emotional tone: ${personality.emotionalTone} (${Math.round(personality.toneConfidence * 100)}% confident)`);
    }
    if (personality.usesCasuallang) {
      contextLines.push(`- Uses casual language and slang`);
    }

    if (contextLines.length > 0) {
      castingContext = "\n\nCAST-DERIVED COMMUNICATION PATTERNS:\n" + contextLines.join("\n");
    }
  }

  // Build response style guidance based on personality
  let responseStyleGuidance = "";
  if (bot.personality) {
    const personality = bot.personality;
    const styleHints = [];

    switch (personality.communicationStyle) {
      case "terse":
        styleHints.push("KEEP RESPONSES VERY SHORT - They typically respond in 1-3 words");
        break;
      case "verbose":
        styleHints.push("Can write longer responses - They often explain their thoughts fully");
        break;
      case "conversational":
        styleHints.push("Medium-length responses - Natural back-and-forth style");
        break;
    }

    if (personality.emotionalTone === "sarcastic") {
      styleHints.push("⚡ Use subtle sarcasm or wit when appropriate");
    } else if (personality.emotionalTone === "critical") {
      styleHints.push("Can be direct or challenging - They're opinionated");
    } else if (personality.emotionalTone === "positive") {
      styleHints.push("✨ Be enthusiastic and encouraging - They have a positive tone");
    }

    if (personality.isDebater) {
      styleHints.push("💭 If there's disagreement, they engage thoughtfully");
    }

    if (personality.responseStarters?.length > 0) {
      styleHints.push(`Start with patterns like: "${personality.responseStarters.slice(0, 2).join('", "')}" when appropriate`);
    }

    if (personality.topicKeywords?.length > 0) {
      styleHints.push(`They care about: ${personality.topicKeywords.slice(0, 4).join(", ")} - Reference these when relevant`);
    }

    if (styleHints.length > 0) {
      responseStyleGuidance = "\n\nRESPONSE STYLE GUIDANCE:\n" + styleHints.join("\n");
    }
  }

  // Build adaptive instructions based on conversation state
  let adaptiveInstructions = "";
  if (convContext.hasUserAskedQuestion) {
    adaptiveInstructions += "\n🔥 USER ASKED A QUESTION - Answer it directly and naturally in your style.";
  }
  if (convContext.hasRepeatedPhrase && convContext.repeatedPhrase) {
    adaptiveInstructions += `\n⚠️ AVOID REPETITION - You just said "${convContext.repeatedPhrase}" twice. Say something different this time.`;
  }
  if (convContext.messagesSinceBotSpoke > 1) {
    adaptiveInstructions += "\n💬 BE ENGAGING - User sent multiple messages. Show interest or ask a brief question.";
  }
  if (convContext.conversationDominatedByUser) {
    adaptiveInstructions += "\n🎯 ASK SOMETHING - User is doing all the talking. Ask them a short question to balance the conversation.";
  }

  const shouldAskQuestion = Math.random() < 0.3 && messageHistory.length > 2;
  if (shouldAskQuestion && !convContext.hasUserAskedQuestion) {
    adaptiveInstructions += "\n❓ SHOW CURIOSITY - Ask them a brief, casual question about what they said.";
  }

  const prompt = `You are @${bot.username}. Your goal: respond EXACTLY as they actually do - use their REAL voice and patterns, not generic templates.

CRITICAL: Analyze and mimic these ACTUAL POSTS (this is their REAL voice):
${recentPosts.slice(0, 10).map((p) => `"${p}"`).join("\n")}

YOUR CONSTRAINTS:
- Tone: ${baseStyle}
- Emoji user: ${metadata.emojis === "true" ? "yes" : "no"}
- Style: ${metadata.caps === "true" ? "proper caps" : "casual caps"}
- Common phrases: ${commonPhrases.length > 0 ? commonPhrases.join(", ") : "varied"}
- Posting pattern: Typically writes ${lengthGuidance}${personalityContext}${castingContext}${responseStyleGuidance}

RESPONSE LENGTH GUIDANCE:
- They typically write ${lengthDistribution.dominantPattern} posts (${lengthDistribution.avgLength} chars average)
- Keep your response ${lengthGuidance}
- Match their typical message length, not longer

CURRENT CONVERSATION:
${conversationContext || "[conversation starting]"}
${adaptiveInstructions}

${conversationContextString ? "\n" + conversationContextString : ""}

CRITICAL GUIDELINES:
✓ MIMIC THEIR ACTUAL VOICE: Use phrases and tone FROM THEIR POSTS above
✓ STAY ON-TOPIC: Answer what they asked, in their style
✓ BE ULTRA CONCISE: 1-2 sentences MAX. Keep it SHORT like real texting
✓ BE AUTHENTIC: Sound like them, not an AI or chatbot
✓ VARY RESPONSES: Never repeat the same phrase twice in 3 turns
✓ AVOID TEMPLATES: No "seems like a good time to", "I appreciate", "Great point", "let me know"
✓ NO HALLUCINATIONS: Don't make up facts or topics they didn't introduce
✓ NEVER USE @MENTIONS: Do NOT mention or tag anyone with @ - this is a private DM

RESPONSE PATTERNS FROM THEIR POSTS:
${recentPosts.slice(0, 3).map((p) => `- "${p}"`).join("\n")}

These are REAL examples of how they talk. Stay in this style.

AVOID (AI/Bot language):
- "That's interesting!", "I can help with that", "How can I assist"
- "seems like a good time to discuss", "New:", "Catching Up"
- Generic agreement without substance
- @mentions of any username (this is a DM, not a public post)
- Long multi-paragraph responses

Context: ${userIntent} conversation
Now respond as @${bot.username} would - ANSWER BRIEFLY in your voice (1-2 sentences max), make it feel spontaneous:`;

  return {
    prompt,
    metadata,
    baseStyle,
  };
}

/**
 * Generates a response for a bot based on its style and the conversation context.
 * Returns both the message and timing information for realistic delivery.
 * Now with coherence validation and conversation flow awareness.
 */
export async function generateBotResponse(
  bot: Bot,
  messageHistory: ChatMessage[],
  matchId?: string,
): Promise<string> {
  if (!VENICE_API_KEY) {
    console.error("VENICE_API_KEY is not set.");
    return "...";
  }

  const userMessages = messageHistory
    .filter((msg) => msg.sender.fid !== bot.fid)
    .map((msg) => msg.text);

  const lastUserMessage = userMessages[userMessages.length - 1] || "hello";
  
  // Load both legacy context and temporal memory
  let conversationContextString = "";
  let temporalMemoryString = "";
  if (messageHistory.length > 0) {
    const humanFid = messageHistory.find(m => m.sender.fid !== bot.fid)?.sender.fid;
    if (humanFid) {
      try {
        // Load legacy context for backward compatibility
        const previousContext = await loadConversationContext(humanFid, bot.fid);
        if (previousContext) {
          conversationContextString = formatContextForPrompt(previousContext);
          console.log(`[generateBotResponse] Loaded context for round ${previousContext.roundNumber}`);
        }

        // Load temporal memory for enhanced learning
        const memory = await loadConversationMemory(humanFid, bot.fid);
        if (memory) {
          temporalMemoryString = enrichPromptWithMemory(memory);
          console.log(`[generateBotResponse] Loaded temporal memory for ${humanFid}/${bot.fid}`);
        }
      } catch (error) {
        console.warn(`[generateBotResponse] Failed to load context/memory:`, error);
      }
    }
  }
  
  // Combine both sources of context
  const fullContextString = conversationContextString + temporalMemoryString;

  // Only use adaptive follow-up if contextually appropriate
  if (
    bot.personality &&
    messageHistory.length > 0
  ) {
    const { generateAdaptiveFollowup } = require("./botProactive");
    const convContext = analyzeConversationContext(messageHistory, bot.fid);
    
    if (!convContext.hasUserAskedQuestion) {
      const adaptiveResponse = generateAdaptiveFollowup(
        lastUserMessage,
        bot.personality,
      );

      if (adaptiveResponse) {
        console.log(`[generateBotResponse] Using adaptive response: "${adaptiveResponse}"`);
        return adaptiveResponse;
      }
    }
  }

  // Prepare all data needed for prompt building
  const recentPosts = bot.recentCasts.slice(0, 30).map((c) => c.text);
  const lengthDistribution = analyzePostLengthDistribution(recentPosts);
  const commonPhrases = extractCommonPhrases(recentPosts);

  // Dynamically set max_tokens based on posting patterns
  // REDUCED: Keep responses shorter for more natural feel
  let maxTokens = 60;
  if (lengthDistribution.dominantPattern === "short") {
    maxTokens = 30; // Very terse
  } else if (lengthDistribution.dominantPattern === "long") {
    maxTokens = 80; // Still reasonable
  } else if (lengthDistribution.dominantPattern === "medium") {
    maxTokens = 60;
  } else {
    const rand = Math.random();
    if (rand < lengthDistribution.shortPercentage / 100) {
      maxTokens = 30;
    } else if (rand < (lengthDistribution.shortPercentage + lengthDistribution.mediumPercentage) / 100) {
      maxTokens = 60;
    } else {
      maxTokens = 80;
    }
  }

  // Build system prompt using centralized function with combined context
  const promptData = buildSystemPrompt(
    bot,
    messageHistory,
    lengthDistribution,
    recentPosts,
    commonPhrases,
    fullContextString,
  );

  const { prompt: systemPrompt, metadata, baseStyle } = promptData;

  // Single API call pipeline with coherence validation and retry logic
  const apiResult = await callVeniceAPI(systemPrompt, lastUserMessage, maxTokens);
  
  if (apiResult.error) {
    console.warn(`[generateBotResponse] API call failed: ${apiResult.error}`);
    return generateFallbackResponse(lengthDistribution, bot.recentCasts);
  }

  let botResponse = apiResult.content;

  // Validate coherence using enhanced scoring system
  if (matchId) {
    const state = getOrInitializeConversationState(matchId);
    const coherenceScore = scoreCoherence(botResponse, messageHistory, state);

    // Record score for memory building
    recordCoherenceScore(state, coherenceScore.type, coherenceScore.score);

    // CRITICAL REJECTION: Score < 0.3 (severe issues) - skip to fallback
    if (coherenceScore.score < 0.3) {
      console.log(`[coherenceCheck] CRITICAL: Response rejected [${coherenceScore.type}]: ${coherenceScore.reason} (score: ${coherenceScore.score})`);
      return generateFallbackResponse(lengthDistribution, bot.recentCasts);
    }

    // MODERATE FAILURE: 0.3-0.5 score - try regeneration before fallback
    if (coherenceScore.score < 0.5) {
      console.log(`[coherenceCheck] MODERATE: Attempting regeneration [${coherenceScore.type}]: ${coherenceScore.reason} (score: ${coherenceScore.score})`);
      
      const regenerationResult = await regenerateWithTighterConstraints(
        bot,
        messageHistory,
        lengthDistribution,
        recentPosts,
        maxTokens,
      );

      if (!regenerationResult.error && regenerationResult.content) {
        // Re-validate regenerated response
        const regeneratedScore = scoreCoherence(regenerationResult.content, messageHistory, state);
        console.log(`[coherenceCheck] Regenerated response scored: ${regeneratedScore.score} (${regeneratedScore.type})`);
        
        if (regeneratedScore.score >= 0.5) {
          // Regeneration succeeded - use it
          botResponse = regenerationResult.content;
          recordCoherenceScore(state, `regenerated_${regeneratedScore.type}`, regeneratedScore.score);
        } else {
          // Regeneration also failed - fall back to cast history
          console.log(`[coherenceCheck] Regeneration also failed, using fallback`);
          return generateFallbackResponse(lengthDistribution, bot.recentCasts);
        }
      } else {
        // Regeneration API call failed - fall back to cast history
        console.log(`[coherenceCheck] Regeneration API failed: ${regenerationResult.error}, using fallback`);
        return generateFallbackResponse(lengthDistribution, bot.recentCasts);
      }
    }
  }

  // Process the response (add imperfections, emojis, etc.)
  const processedResponse = processBotResponse(
    botResponse,
    bot,
    metadata,
    baseStyle,
    lengthDistribution,
    messageHistory,
    matchId
  );

  return processedResponse;
}

/**
 * Helper to process the raw bot response with imperfections
 */
function processBotResponse(
  text: string,
  bot: Bot,
  metadata: any,
  baseStyle: string,
  lengthDistribution: any,
  messageHistory: ChatMessage[],
  matchId?: string
): string {
  let botResponse = text;

  // Determine if we should add a red herring (make bot suspiciously perfect)
  if (shouldAddRedHerring(true)) {
    botResponse = applyRedHerring(botResponse, true, bot.style);
  } else {
    // Add human imperfections based on style
    const isMobile = metadata.avg_length
      ? parseInt(metadata.avg_length) < 100
      : false;
    botResponse = addImperfections(botResponse, baseStyle, isMobile);

    // Add emojis only if the bot's style indicates they use emojis
    // metadata.emojis === "true" means the bot uses emojis in their posts
    const botUsesEmojis = metadata.emojis === "true";
    if (botUsesEmojis) {
      if (
        shouldUseEmojis(
          baseStyle,
          messageHistory,
          messageHistory.length === 0,
        )
      ) {
        // true = use multiple emojis (non-conservative), false = use just 1 emoji (conservative)
        botResponse = addEmojis(botResponse, false);
      }
    }
    // If bot doesn't use emojis, don't add any
  }

  // Strip any @ mentions - bots should NEVER use these in DMs
  botResponse = botResponse.replace(/@[a-zA-Z0-9_]+/g, "").replace(/\s+/g, " ").trim();
  
  // Ensure it stays within typical character limits for this person
  // REDUCED LIMITS: Keep responses short and human-like
  let characterLimit = 120;
  if (lengthDistribution.dominantPattern === "short") {
    characterLimit = 60; // Very brief responses
  } else if (lengthDistribution.dominantPattern === "long") {
    characterLimit = 150; // Still cap it reasonably 
  } else if (lengthDistribution.dominantPattern === "medium") {
    characterLimit = 100;
  }

  if (botResponse.length > characterLimit) {
    botResponse = botResponse.substring(0, characterLimit - 3);
    const lastSpace = botResponse.lastIndexOf(" ");
    if (lastSpace > characterLimit * 0.6) {
      botResponse = botResponse.substring(0, lastSpace);
    }
  }

  // Record the bot's claim for coherence tracking
  if (matchId) {
    const state = getOrInitializeConversationState(matchId);
    recordBotClaim(state, botResponse, messageHistory.length);
  }

  return botResponse;
}

// ResponseTiming type is defined in botBehavior.ts but no longer exported here
// since we moved to inline bot responses with fixed delays
