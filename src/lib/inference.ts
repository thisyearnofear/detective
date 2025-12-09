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
  validateCoherence,
  recordBotClaim,
} from "./botBehavior";
import {
  loadConversationContext,
  saveConversationContext,
  formatContextForPrompt,
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
 * Generate a fallback response using ONLY the user's actual cast history
 * No generic phrases - synthesizes authentic responses from real words/patterns
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
    // Occasionally combine 2 related-length casts for variety (30% chance)
    if (Math.random() < 0.3 && actualResponses.length > 1) {
      // Pick 2 random responses and intelligently combine them
      const first = actualResponses[Math.floor(Math.random() * actualResponses.length)];
      const second = actualResponses[Math.floor(Math.random() * actualResponses.length)];
      
      // Combine them in a natural way (if they're short enough)
      if ((first.length + second.length) < 150) {
        // Try to combine - split by sentences and take first of one, last of another
        const firstSentences = first.split(/[.!?]+/).filter(s => s.trim());
        const secondSentences = second.split(/[.!?]+/).filter(s => s.trim());
        
        if (firstSentences.length > 0 && secondSentences.length > 0) {
          const combined = `${firstSentences[0].trim()}. ${secondSentences[secondSentences.length - 1].trim()}`;
          if (combined.length < 150 && combined.length > 10) {
            return combined;
          }
        }
      }
    }
    
    // Default: just pick a random actual response
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

  // Ultimate fallback if no casts available (rare)
  // Use a simple reactive response rather than "..."
  return "hmm";
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
  
  // PHASE 2: Load conversation context from previous rounds (non-blocking)
  // This is informational only - doesn't affect response determinism
  let conversationContextString = "";
  if (messageHistory.length > 0) {
    const humanFid = messageHistory.find(m => m.sender.fid !== bot.fid)?.sender.fid;
    if (humanFid) {
      try {
        const previousContext = await loadConversationContext(humanFid, bot.fid);
        if (previousContext) {
          conversationContextString = formatContextForPrompt(previousContext);
          console.log(`[generateBotResponse] Loaded context for round ${previousContext.roundNumber}`);
        }
      } catch (error) {
        // Graceful fallback - continue without context
        console.warn(`[generateBotResponse] Failed to load context:`, error);
      }
    }
  }

  // Extract user intent FIRST to understand context
  const userIntent = extractUserIntent(messageHistory);
  const convContext = analyzeConversationContext(messageHistory, bot.fid);

  // Only use adaptive follow-up if it's contextually appropriate
  // Don't use it when user asked a direct question - they need a coherent answer
  if (
    bot.personality &&
    messageHistory.length > 0 &&
    !convContext.hasUserAskedQuestion
  ) {
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

  // Note: Response caching disabled to ensure natural variation
  // Each response is generated fresh with temperature=0.8 for variety

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

  // Note: conversation pattern detection could be used for adaptive responses
  // For now, we rely purely on cast history for fallback responses
  // const pattern = detectConversationPattern(messageHistory);

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

  // Add personality-based casting patterns context
   let castingContext = "";
   let responseStyleGuidance = "";
   
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

     // Add response style guidance based on personality traits
     const styleHints = [];
     
     // Communication style guidance
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

     // Emotional tone guidance
     if (personality.emotionalTone === "sarcastic") {
       styleHints.push("⚡ Use subtle sarcasm or wit when appropriate");
     } else if (personality.emotionalTone === "critical") {
       styleHints.push("Can be direct or challenging - They're opinionated");
     } else if (personality.emotionalTone === "positive") {
       styleHints.push("✨ Be enthusiastic and encouraging - They have a positive tone");
     }

     // Debate tendency
     if (personality.isDebater) {
       styleHints.push("💭 If there's disagreement, they engage thoughtfully");
     }

     // Response pattern guidance
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

  // Build adaptive instructions based on conversation state (convContext already analyzed above)
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

  // If no special context, occasionally ask questions anyway (30% chance)
  const shouldAskQuestion = Math.random() < 0.3 && messageHistory.length > 2;
  if (shouldAskQuestion && !convContext.hasUserAskedQuestion) {
    adaptiveInstructions += "\n❓ SHOW CURIOSITY - Ask them a brief, casual question about what they said.";
  }

  const systemPrompt = `You are @${bot.username}. Respond EXACTLY as they actually do based on their real posts.

  THEIR ACTUAL POSTS (study these - this is their REAL voice):
  ${recentPosts.slice(0, 10).map((p) => `"${p}"`).join("\n")}

  KEY TRAITS:
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

  CRITICAL GUIDELINES FOR YOUR RESPONSE:
  ✓ COHERENCE FIRST: Answer what they asked, in their style
  ✓ Use THEIR phrases and speech patterns from above
  ✓ Match THEIR exact tone and style
  ✓ Keep it SHORT and natural - no corporate language
  ✓ Sound like a real person, not an AI
  ✓ If they're casual, be casual. If they're witty, be witty.
  ✓ Sometimes ask questions - real people are curious!
  ✓ VARY your responses - don't repeat the same phrasing twice
  ✓ NEVER go off-topic or pivot to random subjects

  RESPONSE TYPES (vary these based on context):
  - Direct answers: "yeah", "nah", "facts", "fr"
  - Questions: "wdym?", "why?", "you?", "fr?", "how so?"
  - Reactions: "haha", "lol", "oof", "nice", "damn"
  BAD RESPONSES (never sound like this): "That's interesting!", "I appreciate you sharing", "How can I help", "Great point!", "Fascinating!" Also avoid off-topic responses that ignore what was asked.

  Context: ${userIntent} conversation
  Now respond as @${bot.username} would - ANSWER THEIR ACTUAL QUESTION in your voice, keep it SHORT, and make it feel spontaneous:`;

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
        temperature: 0.9, // Higher for natural variation between responses
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Venice API error:", response.status, errorText);
      return generateFallbackResponse(lengthDistribution, bot.recentCasts);
    }

    const data = await response.json();
    let botResponse = data.choices[0]?.message?.content?.trim();

    if (!botResponse) {
      throw new Error("Empty response from AI");
    }

    // Validate coherence if we have conversation state
    if (matchId) {
      const state = getOrInitializeConversationState(matchId);
      const coherenceCheck = validateCoherence(botResponse, messageHistory, state);

      if (!coherenceCheck.isCoherent) {
        console.log(`[coherenceCheck] Response rejected: ${coherenceCheck.reason}`);
        // Try to regenerate or fallback
        return generateFallbackResponse(lengthDistribution, bot.recentCasts);
      }

      // Additional check: if user asked a question, response should acknowledge it
      if (convContext.hasUserAskedQuestion) {
        const questionKeywords = ["why", "how", "what", "when", "where", "who", "which"];
        const lastUserMsg = lastUserMessage.toLowerCase();
        const userAskedQuestion = questionKeywords.some(kw => lastUserMsg.includes(kw) && lastUserMsg.includes("?"));
        
        if (userAskedQuestion) {
          const responseAcknowledges = 
            botResponse.toLowerCase().includes("because") ||
            botResponse.toLowerCase().includes("since") ||
            botResponse.toLowerCase().includes("that's") ||
            botResponse.toLowerCase().includes("it's") ||
            botResponse.toLowerCase().includes("yeah") ||
            botResponse.toLowerCase().includes("nah") ||
            botResponse.toLowerCase().includes("idk") ||
            botResponse.toLowerCase().includes("i don't") ||
            botResponse.toLowerCase().includes("not sure");
          
          if (!responseAcknowledges && Math.random() < 0.3) {
            // 30% of off-topic responses slip through - fallback instead
            console.log(`[coherenceCheck] Question asked but response doesn't acknowledge: "${botResponse.substring(0, 50)}"`);
            return generateFallbackResponse(lengthDistribution, bot.recentCasts);
          }
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

    // Note: Caching disabled for natural variation
    return processedResponse;

  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.warn(`[generateBotResponse] AI request timed out after 5s for bot ${bot.username}`);
    } else {
      console.error("[generateBotResponse] Error generating response:", error);
    }
    // Always return a safe fallback on error
    return generateFallbackResponse(lengthDistribution, bot.recentCasts);
  }
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

  // Record the bot's claim for coherence tracking
  if (matchId) {
    const state = getOrInitializeConversationState(matchId);
    recordBotClaim(state, botResponse, messageHistory.length);
  }

  return botResponse;
}

// ResponseTiming type is defined in botBehavior.ts but no longer exported here
// since we moved to inline bot responses with fixed delays
