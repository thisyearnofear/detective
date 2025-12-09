/**
 * Calculate realistic typing delay based on message properties and personality
 * Includes thinking time (before typing) + simulated typing speed
 * Makes bot messages feel more natural with variable delays based on style
 */

// Count emoji in a string (rough estimate)
function countEmojis(text: string): number {
  // Match common emoji patterns
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

/**
 * Determine if a message requires "thinking time" (complex responses)
 * Questions, controversial topics, or direct answers need more consideration
 */
function requiresThinking(message: string, userMessage?: string): boolean {
  // If responding to a question, add thinking time
  if (userMessage?.includes("?")) {
    return true;
  }
  
  // If response contains opinion markers, more thinking
  const opinionMarkers = /\b(think|believe|imo|tbh|honestly|actually|disagree|agree)\b/i;
  if (opinionMarkers.test(message)) {
    return true;
  }
  
  // If response is longer (usually more thoughtful), needs thinking
  if (message.length > 100) {
    return true;
  }
  
  return false;
}

/**
 * Calculate typing delay in milliseconds
 * 
 * STRUCTURE:
 * 1. Thinking time: 1.5-4s (personality-dependent)
 *    - terse: 1.5-2.5s (quick decisions)
 *    - conversational: 2-3.5s (balanced)
 *    - verbose: 2.5-4s (thoughtful)
 * 2. Typing time: 50-400ms (message-dependent)
 *    - Base: 50ms
 *    - Characters: ~30ms per 50 chars (realistic typing speed ~100 WPM)
 *    - Emojis: +200ms per emoji (slower to select emojis)
 * 
 * @param message The message to be "typed"
 * @param communicationStyle The bot's style: "terse" | "conversational" | "verbose"
 * @param userMessage Optional: the user's message they're responding to
 */
export function calculateTypingDelay(
  message: string,
  communicationStyle: "terse" | "conversational" | "verbose" = "conversational",
  userMessage?: string,
): number {
  // THINKING TIME (varies by personality)
  let thinkingTime: number;
  const shouldThink = requiresThinking(message, userMessage);
  
  if (!shouldThink) {
    // Quick reaction (emoji responses, short agreements) - minimal thinking
    thinkingTime = 200 + Math.random() * 400; // 200-600ms
  } else {
    // Complex response - personality-dependent thinking time
    switch (communicationStyle) {
      case "terse":
        // Fast thinker - quick decisions
        thinkingTime = 1500 + Math.random() * 1000; // 1.5-2.5s
        break;
      case "verbose":
        // Thoughtful communicator - takes time to compose
        thinkingTime = 2500 + Math.random() * 1500; // 2.5-4s
        break;
      case "conversational":
      default:
        // Balanced - medium thinking time
        thinkingTime = 2000 + Math.random() * 1500; // 2-3.5s
    }
  }
  
  // TYPING TIME (how long to simulate the typing animation)
  const CHAR_TYPING_SPEED = 30; // ms per 50 characters (~100 WPM)
  const EMOJI_DELAY = 200; // ms per emoji (slower to select/type)
  
  const charTypingTime = Math.floor((message.length / 50) * CHAR_TYPING_SPEED);
  const emojiCount = countEmojis(message);
  const emojiTypingTime = emojiCount * EMOJI_DELAY;
  
  // Base typing simulation (minimum 50ms)
  const baseTypingTime = 50;
  const typingTime = baseTypingTime + charTypingTime + emojiTypingTime;
  
  // TOTAL DELAY
  const totalDelay = thinkingTime + typingTime;
  
  // Cap at 7 seconds max (very long, emoji-heavy responses with verbose personality)
  return Math.min(totalDelay, 7000);
}

/**
 * Example delays (with conversational style):
 * 
 * Quick reactions:
 * "yeah" (4 chars, 0 emoji) = 200-600ms thinking + 50ms typing = 250-650ms
 * "lol" (3 chars, 0 emoji) = 200-600ms thinking + 50ms typing = 250-650ms
 * "yeah 🦄" (7 chars, 1 emoji) = 200-600ms thinking + 50 + 200ms = 450-850ms
 * 
 * Medium responses:
 * "that's interesting actually" (28 chars, 0 emoji) = 2-3.5s thinking + (28/50)*30 + 0 = 2-3.5s
 * "i think so tbh 🔥" (16 chars, 1 emoji) = 2-3.5s thinking + 50 + 200 = 2.25-3.75s
 * 
 * Complex responses:
 * "honestly I'm not sure what you mean by that" (44 chars, 0 emoji) = 2-3.5s thinking + (44/50)*30 = 2-3.56s
 * "disagree actually, here's why... 🎯 ⚡" (39 chars, 2 emoji) = 2-3.5s thinking + (39/50)*30 + 400 = 2.42-3.94s
 */
