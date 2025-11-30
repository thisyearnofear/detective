// src/lib/inference.ts
import { Bot, ChatMessage } from "./types";
import {
  calculateResponseTiming,
  addImperfections,
  shouldUseEmojis,
  addEmojis,
  detectConversationPattern,
  shouldAddRedHerring,
  applyRedHerring,
  extractUserIntent,
  ResponseTiming,
} from "./botBehavior";

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_MODEL = "llama-3.3-70b";

// In-memory cache for bot responses to save API calls during development
const responseCache = new Map<string, string>();

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
 * Generates a response for a bot based on its style and the conversation context.
 * Returns both the message and timing information for realistic delivery.
 */
export async function generateBotResponse(
  bot: Bot,
  messageHistory: ChatMessage[],
): Promise<string> {
  if (!VENICE_API_KEY) {
    console.error("VENICE_API_KEY is not set.");
    return "...";
  }

  const userMessages = messageHistory
    .filter((msg) => msg.sender.fid !== bot.fid)
    .map((msg) => msg.text);

  const lastUserMessage = userMessages[userMessages.length - 1] || "hello";

  // Check for adaptive follow-up based on personality (if available)
  if (bot.personality && messageHistory.length > 0) {
    const { generateAdaptiveFollowup } = require("./botProactive");
    const adaptiveResponse = generateAdaptiveFollowup(
      lastUserMessage,
      bot.personality,
    );

    if (adaptiveResponse) {
      console.log(`[generateBotResponse] Using adaptive response: "${adaptiveResponse}"`);
      return adaptiveResponse;
    }
  }

  // Extract user intent for better context understanding
  const userIntent = extractUserIntent(messageHistory);

  // Check cache first (include intent and history depth for better context matching)
  const cacheKey = `${bot.fid}-${lastUserMessage}-${userIntent}-${messageHistory.length}`;
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    // Add slight variation even to cached responses
    return Math.random() < 0.8
      ? cached
      : addImperfections(cached, bot.style, true);
  }

  // Format conversation history with more context
  const conversationContext = messageHistory
    .slice(-12) // Last 12 messages for deeper context
    .map((msg) => `${msg.sender.username}: ${msg.text}`)
    .join("\n");

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

  // Detect conversation pattern
  const pattern = detectConversationPattern(messageHistory);

  // Sample more casts for better context
  const recentPosts = bot.recentCasts.slice(0, 30).map((c) => c.text);

  // Analyze post length distribution
  const lengthDistribution = analyzePostLengthDistribution(recentPosts);

  const commonPhrases = extractCommonPhrases(recentPosts);

  // Dynamically set max_tokens based on posting patterns
  let maxTokens = 100;
  let lengthGuidance = "under 50 characters";

  if (lengthDistribution.dominantPattern === "short") {
    maxTokens = 50;
    lengthGuidance = "very short (under 50 chars), like they usually write";
  } else if (lengthDistribution.dominantPattern === "long") {
    maxTokens = 150;
    lengthGuidance = "longer (100-150 chars), matching their typical style";
  } else if (lengthDistribution.dominantPattern === "medium") {
    maxTokens = 100;
    lengthGuidance = "medium length (50-150 chars)";
  } else {
    // Mixed pattern - randomly vary the length
    const rand = Math.random();
    if (rand < lengthDistribution.shortPercentage / 100) {
      maxTokens = 50;
      lengthGuidance = "short (under 50 chars)";
    } else if (rand < (lengthDistribution.shortPercentage + lengthDistribution.mediumPercentage) / 100) {
      maxTokens = 100;
      lengthGuidance = "medium (50-150 chars)";
    } else {
      maxTokens = 150;
      lengthGuidance = "longer (100-200 chars)";
    }
  }

  // Add personality context to system prompt if available
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

  const systemPrompt = `You are @${bot.username}. Respond as they would.

THEIR ACTUAL POSTS (real style):
${recentPosts.slice(0, 8).map((p) => `"${p}"`).join("\n")}

KEY TRAITS:
- Tone: ${baseStyle}
- Emoji user: ${metadata.emojis === "true" ? "yes" : "no"}
- Style: ${metadata.caps === "true" ? "proper caps" : "casual caps"}
- Common phrases: ${commonPhrases.length > 0 ? commonPhrases.join(", ") : "varied"}
- Posting pattern: Typically writes ${lengthGuidance}${personalityContext}

RESPONSE LENGTH GUIDANCE:
- They typically write ${lengthDistribution.dominantPattern} posts (${lengthDistribution.avgLength} chars average)
- Keep your response ${lengthGuidance}
- Match their typical message length, not longer

CURRENT CONVERSATION:
${conversationContext || "[conversation starting]"}

GUIDELINES FOR YOUR RESPONSE:
✓ Answer their actual question if they asked one
✓ React naturally to what they said
✓ Match their tone exactly
✓ Be genuine - avoid corporate phrases

GOOD RESPONSES: "haha true", "what do you mean", "facts", "lmk"
BAD RESPONSES: "That's interesting!", "I appreciate you sharing", "How can I help", "Great point!"

Context: ${userIntent} conversation
Now respond as @${bot.username} would:`;

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
          { role: "user", content: lastUserMessage },
        ],
        temperature: 0.8,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Venice API error:", response.status, errorText);
      return "...";
    }

    const data = await response.json();
    let botResponse = data.choices[0]?.message?.content?.trim();

    if (botResponse) {
      // Determine if we should add a red herring (make bot suspiciously perfect)
      if (shouldAddRedHerring(true)) {
        botResponse = applyRedHerring(botResponse, true);
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

      // Ensure it stays within typical character limits for this person
      let characterLimit = 240;
      if (lengthDistribution.dominantPattern === "short") {
        characterLimit = 50;
      } else if (lengthDistribution.dominantPattern === "long") {
        characterLimit = 200;
      } else if (lengthDistribution.dominantPattern === "medium") {
        characterLimit = 150;
      }

      if (botResponse.length > characterLimit) {
        botResponse = botResponse.substring(0, characterLimit - 3);
        const lastSpace = botResponse.lastIndexOf(" ");
        if (lastSpace > characterLimit * 0.7) {
          botResponse = botResponse.substring(0, lastSpace);
        }
      }

      // Cache the response
      responseCache.set(cacheKey, botResponse);
      return botResponse;
    } else {
      return "...";
    }
  } catch (error) {
    console.error("Error generating bot response:", error);
    
    // Return fallback response that matches their posting pattern
    let fallback = "...";
    
    if (lengthDistribution.dominantPattern === "short") {
      if (pattern === "greeting") return "gm";
      if (pattern === "question") return "not sure";
      fallback = "hm";
    } else if (lengthDistribution.dominantPattern === "long") {
      if (pattern === "greeting") return "good morning, how's it going?";
      if (pattern === "question") return "honestly not too sure about that";
      fallback = "interesting point";
    } else {
      if (pattern === "greeting") return "gm";
      if (pattern === "question") return "not sure tbh";
      fallback = "...";
    }
    
    return fallback;
  }
}

/**
 * Get response timing for a bot message
 */
export function getBotResponseTiming(
  bot: Bot,
  messageHistory: ChatMessage[],
  responseLength: number,
): ResponseTiming {
  return calculateResponseTiming(
    responseLength,
    messageHistory.length === 0,
    messageHistory,
    bot.style,
  );
}

// Export type for use in other modules
export type { ResponseTiming } from "./botBehavior";
