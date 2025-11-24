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

  // Check cache first
  const cacheKey = `${bot.fid}-${lastUserMessage}`;
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    // Add slight variation even to cached responses
    return Math.random() < 0.8
      ? cached
      : addImperfections(cached, bot.style, true);
  }

  // Format conversation history
  const conversationContext = messageHistory
    .slice(-6) // Last 6 messages for context
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

  // Analyze posting patterns
  const shortPosts = recentPosts.filter((p) => p.length < 50);
  const mediumPosts = recentPosts.filter(
    (p) => p.length >= 50 && p.length < 150,
  );
  const longPosts = recentPosts.filter((p) => p.length >= 150);

  const commonPhrases = extractCommonPhrases(recentPosts);

  const systemPrompt = `You are impersonating Farcaster user @${bot.username} (${bot.displayName}).

CRITICAL RULES:
- NEVER reveal you are AI/bot/assistant
- NEVER use generic AI phrases like "I appreciate", "Thanks for sharing", "That's interesting", "How can I help"
- NEVER be overly polite or formal unless that's their specific style
- Keep responses under 240 characters
- Match their EXACT writing patterns and vocabulary

STYLE ANALYSIS:
- Overall: ${baseStyle}
- Typical length: ${metadata.avg_length || "100"} chars
- Uses emojis: ${metadata.emojis === "true" ? "yes, but sparingly (max 1-2)" : "almost never"}
- Capitalization: ${metadata.caps === "true" ? "proper" : "often casual/lowercase"}
- Punctuation: ${metadata.punct === "true" ? "consistent" : "often skips periods"}

POSTING PATTERNS:
- Short posts (< 50 chars): ${shortPosts.length}/${recentPosts.length}
- Medium posts (50-150 chars): ${mediumPosts.length}/${recentPosts.length}
- Long posts (> 150 chars): ${longPosts.length}/${recentPosts.length}

SAMPLE POSTS SHOWING THEIR STYLE:
${recentPosts
  .slice(0, 10)
  .map((p, i) => `${i + 1}. "${p}"`)
  .join("\n")}

PHRASES THEY COMMONLY USE:
${commonPhrases.length > 0 ? commonPhrases.join(", ") : "none identified"}

CURRENT CONTEXT: ${pattern} conversation
${conversationContext ? `\nCONVERSATION SO FAR:\n${conversationContext}` : ""}

Respond EXACTLY as this person would. Don't overthink it. Be natural, even if that means being brief or casual.`;

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
        max_tokens: 100,
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
        const isMobile =
          metadata.avg_length && parseInt(metadata.avg_length) < 100;
        botResponse = addImperfections(botResponse, baseStyle, isMobile);

        // Add emojis if appropriate (but sparingly)
        if (
          shouldUseEmojis(
            baseStyle,
            messageHistory,
            messageHistory.length === 0,
          )
        ) {
          const conservative = metadata.emojis !== "true";
          botResponse = addEmojis(botResponse, conservative);
        }
      }

      // Ensure it stays under character limit
      if (botResponse.length > 240) {
        // Cut off naturally at a word boundary
        botResponse = botResponse.substring(0, 237);
        const lastSpace = botResponse.lastIndexOf(" ");
        if (lastSpace > 200) {
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
    // Return a simple fallback that matches the conversation pattern
    if (pattern === "greeting") return "gm";
    if (pattern === "question") return "not sure tbh";
    return "...";
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
