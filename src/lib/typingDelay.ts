/**
 * Calculate realistic typing delay based on message properties
 * Makes bot messages appear less instant by simulating human typing speed
 */

// Count emoji in a string (rough estimate)
function countEmojis(text: string): number {
  // Match common emoji patterns
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

/**
 * Calculate typing delay in milliseconds
 * 
 * Base: 200ms minimum (appears natural)
 * Message length: ~50ms per 20 characters (average typing speed)
 * Emojis: +300ms per emoji (slower to "find" emojis)
 */
export function calculateTypingDelay(message: string): number {
  const BASE_DELAY = 200;
  const CHAR_SPEED = 50; // ms per 20 chars
  const EMOJI_DELAY = 300; // ms per emoji
  
  const charDelay = Math.floor((message.length / 20) * CHAR_SPEED);
  const emojiCount = countEmojis(message);
  const emojiDelay = emojiCount * EMOJI_DELAY;
  
  // Total: base + char delay + emoji delay
  const totalDelay = BASE_DELAY + charDelay + emojiDelay;
  
  // Cap at 5 seconds max (even long emoji-heavy messages)
  return Math.min(totalDelay, 5000);
}

/**
 * Example delays:
 * "hello" (5 chars, 0 emoji) = 200 + 12 + 0 = 212ms
 * "hello 🦄" (8 chars, 1 emoji) = 200 + 20 + 300 = 520ms
 * "hey there! 🎉 🔥 ✨" (15 chars, 3 emoji) = 200 + 37 + 900 = 1137ms
 */
