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
 * Calculate typing delay in milliseconds with significant variance
 * 
 * STRUCTURE:
 * 1. "Reading" time: Variable pause before typing starts (1-4s)
 *    - Simulates user reading the message before responding
 * 2. Thinking time: 1.5-6s (personality-dependent, with random variance)
 *    - terse: 1.5-3s (quick but varies)
 *    - conversational: 2-5s (natural range)
 *    - verbose: 3-6s (more thoughtful)
 * 3. Typing time: 100-600ms (message-dependent)
 *    - Base: 100ms 
 *    - Characters: ~40ms per 50 chars (realistic typing ~80 WPM)
 *    - Emojis: +300ms per emoji (takes time to find/select)
 * 4. Random "distraction" delay: 0-2s (simulates multitasking)
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
  // READING TIME - simulate reading the user's message first
  // Longer messages from user = longer reading time
  const userMessageLength = userMessage?.length || 20;
  const readingBase = 500 + Math.random() * 1000; // 500-1500ms base
  const readingTime = readingBase + Math.min(userMessageLength * 15, 1500); // +15ms per char, max 1.5s

  // THINKING TIME (varies by personality with HIGH variance)
  let thinkingTime: number;
  const shouldThink = requiresThinking(message, userMessage);

  // Add randomness multiplier (0.6 to 1.6 - significant variance)
  const varianceMultiplier = 0.6 + Math.random() * 1.0;

  if (!shouldThink) {
    // Quick reaction - still has some variance
    thinkingTime = (400 + Math.random() * 1200) * varianceMultiplier; // 240-960ms to 640-2560ms
  } else {
    // Complex response - personality-dependent with variance
    switch (communicationStyle) {
      case "terse":
        // Fast but not robotic
        thinkingTime = (1500 + Math.random() * 1500) * varianceMultiplier; // 900-1800ms to 2400-4800ms  
        break;
      case "verbose":
        // Thoughtful - takes their time
        thinkingTime = (3000 + Math.random() * 2000) * varianceMultiplier; // 1800-3000ms to 4800-8000ms
        break;
      case "conversational":
      default:
        // Natural range
        thinkingTime = (2000 + Math.random() * 2500) * varianceMultiplier; // 1200-2700ms to 3200-7200ms
    }
  }

  // TYPING TIME (simulation of actual typing)
  const CHAR_TYPING_SPEED = 40; // ms per 50 characters (~80 WPM, slightly slower)
  const EMOJI_DELAY = 300; // ms per emoji

  const charTypingTime = Math.floor((message.length / 50) * CHAR_TYPING_SPEED);
  const emojiCount = countEmojis(message);
  const emojiTypingTime = emojiCount * EMOJI_DELAY;

  // Base typing simulation (minimum 100ms)
  const baseTypingTime = 100;
  const typingTime = (baseTypingTime + charTypingTime + emojiTypingTime) * (0.8 + Math.random() * 0.4);

  // DISTRACTION DELAY - random pause simulating multitasking
  // 30% chance of a "distraction" adding 0-2 seconds
  const distractionDelay = Math.random() < 0.3 ? Math.random() * 2000 : 0;

  // TOTAL DELAY with all components
  const totalDelay = readingTime + thinkingTime + typingTime + distractionDelay;

  // Cap at 10 seconds max, but allow more variance than before
  // Minimum 1.5 seconds to avoid seeming too robotic
  return Math.max(1500, Math.min(totalDelay, 10000));
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
