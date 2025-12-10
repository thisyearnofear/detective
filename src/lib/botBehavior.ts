// src/lib/botBehavior.ts

import { ChatMessage } from "./types";

/**
 * Bot behavior configuration and utilities for more realistic bot interactions
 */

// Common typos and autocorrect mistakes
const TYPO_PATTERNS = [
  { original: "the", typos: ["teh", "hte", "th"] },
  { original: "and", typos: ["adn", "nad", "an"] },
  { original: "you", typos: ["yuo", "yo", "u"] },
  { original: "that", typos: ["taht", "tht", "htat"] },
  { original: "with", typos: ["wtih", "wiht", "wit"] },
  { original: "have", typos: ["ahve", "hav", "hvae"] },
  { original: "from", typos: ["form", "frmo", "fro"] },
  { original: "what", typos: ["waht", "wht", "whta"] },
  { original: "been", typos: ["bene", "ben", "beem"] },
  { original: "going", typos: ["goin", "gonig", "giong"] },
];

// Mobile autocorrect mistakes
const AUTOCORRECT_MISTAKES = [
  { intended: "ur", autocorrected: "your" },
  { intended: "u", autocorrected: "I" },
  { intended: "im", autocorrected: "I'm" },
  { intended: "dont", autocorrected: "don't" },
  { intended: "cant", autocorrected: "can't" },
  { intended: "wont", autocorrected: "won't" },
];

// DEPRECATED: Response templates have been replaced with cast-history-based responses
// Kept for backward compatibility with botProactive.ts fallbacks only
// These should be phased out in favor of extracting actual responses from cast history
const RESPONSE_TEMPLATES = {
  deflectVerbose: [
    "that's a weird thing to fixate on",
    "why are you so concerned about that?",
    "does it matter?",
    "depends what you mean by that tbh",
    "lol random question",
  ],
  deflectTerse: ["?", "why", "dunno"],
  evasiveVerbose: ["interesting way to answer that"],
  evasiveTerse: ["hmm", "..."],
  defensiveVerbose: ["fair point"],
  defensiveTerse: ["fair"],
  agreeVerbose: ["yeah exactly", "right?", "lol yeah", "no cap"],
  agreeTerse: ["fr", "right", "lol", "facts"],
  followUpVerbose: ["you there?", "lol", "hmm", "interesting", "what do you think?"],
  followUpTerse: ["?", "...", "yo", "hello?", "lol"],
};

export const RESPONSE_STYLES = RESPONSE_TEMPLATES;

// Response timing patterns
export interface ResponseTiming {
  initialDelay: number; // Time before starting to type (ms)
  typingDuration: number; // How long it takes to type the message (ms)
  hasTypingPauses: boolean; // Whether to include pauses (thinking)
  pausePositions?: number[]; // Where in the message to pause
}

/**
 * Calculate realistic response timing based on context
 */
export function calculateResponseTiming(
  messageLength: number,
  isFirstMessage: boolean,
  messageHistory: ChatMessage[],
  userStyle: string,
): ResponseTiming {
  // Use parameters to avoid unused variable errors in FAST GAME MODE
  const lengthFactor = Math.min(messageLength / 100, 1); // Max 1 for messages longer than 100 chars
  const isInitial = isFirstMessage || messageHistory.length === 0; // Check if it's a first message
  const styleFactor = userStyle.length > 0 ? 1 : 0; // Check if style is provided
  // FAST GAME MODE: Eliminate artificial delays
  // Natural AI generation latency (1-3s) provides sufficient human-like timing
  
  // Minimal delay for immediate delivery after AI generation completes
  const minimalDelay = 100 + Math.random() * 200; // 100-300ms just for natural feel
  
  // No artificial typing simulation - deliver immediately
  const instantDelivery = 0;

  const baseDelay = minimalDelay;

  const adjustedDelay = baseDelay + (lengthFactor * 50) + (isInitial ? 100 : 0) + (styleFactor * 25);

  return {
    initialDelay: adjustedDelay, // Minimal delay for realism, adjusted for parameters
    typingDuration: instantDelivery, // No simulated typing
    hasTypingPauses: false, // No typing pauses
  };
}

/**
 * Add human imperfections to a message
 */
export function addImperfections(
  message: string,
  userStyle: string,
  isMobile: boolean = Math.random() < 0.7, // 70% on mobile
): string {
  // Determine imperfection probability based on style
  let typoChance = 0.05; // 5% base chance
  let autocorrectChance = 0.03; // 3% base chance
  let punctuationIssueChance = 0.1; // 10% base chance

  if (userStyle.includes("casual") || userStyle.includes("informal")) {
    typoChance = 0.08;
    punctuationIssueChance = 0.3;
  } else if (userStyle.includes("careful") || userStyle.includes("formal")) {
    typoChance = 0.02;
    punctuationIssueChance = 0.05;
  }

  let result = message;

  // Add typos
  if (Math.random() < typoChance) {
    const words = result.split(" ");
    const wordIndex = Math.floor(Math.random() * words.length);
    const word = words[wordIndex].toLowerCase();

    const typoPattern = TYPO_PATTERNS.find((p) => p.original === word);
    if (typoPattern && typoPattern.typos.length > 0) {
      const typo =
        typoPattern.typos[Math.floor(Math.random() * typoPattern.typos.length)];
      words[wordIndex] = words[wordIndex].replace(word, typo);
      result = words.join(" ");
    }
  }

  // Mobile autocorrect mistakes
  if (isMobile && Math.random() < autocorrectChance) {
    for (const mistake of AUTOCORRECT_MISTAKES) {
      if (result.includes(mistake.intended)) {
        result = result.replace(mistake.intended, mistake.autocorrected);
        break;
      }
    }
  }

  // Punctuation issues
  if (Math.random() < punctuationIssueChance) {
    const punctuationIssues = [
      () => result.replace(/\.$/, ""), // Missing period
      () => result.replace(/\?$/, ""), // Missing question mark
      () => result.toLowerCase(), // No capitalization
      () => result.replace(/^./, (c) => c.toLowerCase()), // No initial cap
      () => result + "..", // Double period
      () => result.replace(/\s,/g, ","), // No space after comma
    ];

    const issue =
      punctuationIssues[Math.floor(Math.random() * punctuationIssues.length)];
    result = issue();
  }

  // Sometimes people don't finish their
  if (Math.random() < 0.02) {
    // 2% chance
    const words = result.split(" ");
    if (words.length > 3) {
      words.pop();
      result = words.join(" ");
    }
  }

  return result;
}

/**
 * Determine if bot should use emojis based on context
 */
export function shouldUseEmojis(
  userStyle: string,
  messageHistory: ChatMessage[],
  isFirstMessage: boolean,
): boolean {
  // Base emoji probability from style analysis
  let emojiProbability = 0.1; // 10% base

  if (userStyle.includes("emoji") || userStyle.includes("expressive")) {
    emojiProbability = 0.6;
  } else if (
    userStyle.includes("professional") ||
    userStyle.includes("formal")
  ) {
    emojiProbability = 0.02;
  }

  // Check if human has used emojis
  const humanMessages = messageHistory.filter(
    (m) => m.sender.fid !== messageHistory[0]?.sender.fid,
  );
  const humanUsedEmojis = humanMessages.some((m) =>
    /[\u{1F300}-\u{1F9FF}]/u.test(m.text),
  );

  if (humanUsedEmojis) {
    // Mirror behavior slightly
    emojiProbability = Math.min(emojiProbability * 1.5, 0.4);
  }

  // First messages rarely have emojis unless it's a "gm" response
  if (isFirstMessage && !messageHistory[0]?.text.toLowerCase().includes("gm")) {
    emojiProbability *= 0.3;
  }

  return Math.random() < emojiProbability;
}

/**
 * Generate realistic emoji usage
 */
export function addEmojis(
  message: string,
  conservative: boolean = true,
): string {
  // Use the same emojis available in the UI picker
  const commonEmojis = ["🦄", "🎩", "🌈", "🟣", "🚀", "👀", "🔥", "✨"];
  const rareEmojis = ["🫡", "💯", "🤝", "💜", "🌟", "⚡", "🎯", "💎"];

  if (conservative) {
    // Add max 1 emoji, usually at the end
    if (Math.random() < 0.7) {
      // 70% chance at end
      const emoji =
        commonEmojis[Math.floor(Math.random() * commonEmojis.length)];
      return `${message} ${emoji}`;
    } else {
      // 30% chance inline
      const words = message.split(" ");
      const position = Math.floor(Math.random() * words.length);
      const emoji =
        commonEmojis[Math.floor(Math.random() * commonEmojis.length)];
      words.splice(position, 0, emoji);
      return words.join(" ");
    }
  } else {
    // Power user mode - multiple emojis
    let result = message;
    const emojiCount = Math.floor(Math.random() * 3) + 1; // 1-3 emojis
    for (let i = 0; i < emojiCount; i++) {
      const emojiSet = Math.random() < 0.7 ? commonEmojis : rareEmojis;
      const emoji = emojiSet[Math.floor(Math.random() * emojiSet.length)];

      if (Math.random() < 0.5 && i === emojiCount - 1) {
        result += ` ${emoji}`;
      } else {
        const words = result.split(" ");
        const position = Math.floor(Math.random() * words.length);
        words.splice(position, 0, emoji);
        result = words.join(" ");
      }
    }
    return result;
  }
}

/**
 * Generate typing indicators with realistic patterns
 */
export interface TypingIndicator {
  isTyping: boolean;
  startTime: number;
  endTime: number;
  hasPauses: boolean;
  pauseTimes?: Array<{ start: number; duration: number }>;
}

export function generateTypingPattern(timing: ResponseTiming): TypingIndicator {
  const now = Date.now();
  const indicator: TypingIndicator = {
    isTyping: true,
    startTime: now + timing.initialDelay,
    endTime: now + timing.initialDelay + timing.typingDuration,
    hasPauses: timing.hasTypingPauses,
  };

  if (timing.hasTypingPauses) {
    // Add 1-2 pauses during typing
    const pauseCount = Math.random() < 0.7 ? 1 : 2;
    indicator.pauseTimes = [];

    for (let i = 0; i < pauseCount; i++) {
      const pauseStart =
        timing.initialDelay +
        (timing.typingDuration * (i + 1)) / (pauseCount + 1);
      const pauseDuration = 500 + Math.random() * 1500; // 0.5-2 seconds
      indicator.pauseTimes.push({
        start: now + pauseStart,
        duration: pauseDuration,
      });
    }
  }

  return indicator;
}

/**
 * Extract user intent from conversation to improve context understanding
 */
export function extractUserIntent(
  messageHistory: ChatMessage[],
): string {
  if (messageHistory.length === 0) return "unknown";

  const lastMsg = messageHistory[messageHistory.length - 1]?.text || "";

  if (lastMsg.includes("?")) return "question";
  if (/^(gm|gn|hello|hey|hi)\b/i.test(lastMsg)) return "greeting";
  if (lastMsg.length < 20 && !lastMsg.includes("?")) return "brief_reaction";
  if (
    lastMsg.includes("lol") ||
    lastMsg.includes("lmao") ||
    lastMsg.includes("😂")
  )
    return "humor";
  if (
    lastMsg.includes("wen") ||
    lastMsg.includes("soon") ||
    lastMsg.includes("moon")
  )
    return "speculation";
  if (
    lastMsg.includes("agree") ||
    lastMsg.includes("disagree") ||
    lastMsg.includes("think")
  )
    return "discussion";

  return "statement";
}

/**
 * Red herring behaviors - make bots occasionally too perfect or humans seem bot-like
 */
export function shouldAddRedHerring(isBot: boolean): boolean {
  if (isBot) {
    // 10% chance for bots to be suspiciously perfect
    return Math.random() < 0.1;
  } else {
    // 5% chance to add bot-like behavior to humans
    return Math.random() < 0.05;
  }
}

export function applyRedHerring(message: string, isBot: boolean, userStyle?: string): string {
  if (isBot) {
    if (!userStyle) return message;
    
    const usesProperCaps = userStyle.includes("caps:true");
    const isPunctilious = userStyle.includes("punct:true");
    
    if (usesProperCaps || isPunctilious) {
      return (
        message
          .split(". ")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(". ")
          .replace(/\s+/g, " ")
          .trim() + "."
      );
    }
    return message;
  } else {
    const templates = [
      "That's an interesting point!",
      "I appreciate your perspective.",
      "Thanks for sharing that.",
      "That makes sense to me.",
      "I can see where you're coming from.",
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

export interface ConversationState {
  botClaims: Array<{ claim: string; messageIndex: number; timestamp: number }>;
  topicsRaised: string[];
  stanceOnTopics: Record<string, string>;
  // Track coherence scores for memory building
  coherenceScores: Array<{ type: string; score: number; timestamp: number }>;
}

export function initializeConversationState(): ConversationState {
  return {
    botClaims: [],
    topicsRaised: [],
    stanceOnTopics: {},
    coherenceScores: [],
  };
}

export function extractConversationTopics(message: string): string[] {
  const topics: string[] = [];
  
  const topicPatterns = [
    /monad|mainnet|blockchain|crypto|token|web3/i,
    /wen|soon|launch|release|deploy/i,
    /price|moon|lfg|wagmi|gm|gn/i,
    /question|think|opinion|view|take|thoughts?/i,
  ];
  
  for (const pattern of topicPatterns) {
    if (pattern.test(message)) {
      topics.push(pattern.source.split("|")[0].toLowerCase());
    }
  }
  
  return topics;
}

/**
 * Score coherence of a bot response with detailed feedback
 * Returns actionable score + type for learning and adaptation
 */
export function scoreCoherence(
  proposedResponse: string,
  messageHistory: ChatMessage[],
  state: ConversationState,
): {
  score: number; // 0-1
  type: 'on-topic' | 'evasive' | 'repetitive' | 'off-brand' | 'strong';
  reason: string;
} {
  const lower = proposedResponse.toLowerCase();
  
  if (messageHistory.length === 0) {
    return { score: 1.0, type: 'strong', reason: 'First message - no context to contradict' };
  }

  // Check for internal contradictions
  for (const { claim } of state.botClaims) {
    const claimLower = claim.toLowerCase();
    
    if (
      claimLower.includes("it's on mainnet") &&
      lower.includes("not on mainnet")
    ) {
      return {
        score: 0.1,
        type: 'off-brand',
        reason: 'contradicts earlier claim about mainnet status',
      };
    }
    
    if (
      claimLower.includes("i think") &&
      lower.includes("never thought that")
    ) {
      return {
        score: 0.2,
        type: 'off-brand',
        reason: 'directly contradicts stated opinion',
      };
    }
  }
  
  // Check for immediate reversals
  const botMessages = messageHistory.filter((m) => m.sender.fid === messageHistory[0]?.sender.fid);
  if (botMessages.length > 0) {
    const lastBotMessage = botMessages[botMessages.length - 1]?.text.toLowerCase() || "";
    
    if (
      lastBotMessage.includes("yes") &&
      lower.includes("no, definitely not") &&
      messageHistory.length < 4
    ) {
      return {
        score: 0.3,
        type: 'off-brand',
        reason: 'immediate reversal of simple affirmation',
      };
    }
  }

  // Check if response is repetitive (exact or near-duplicate)
  const recentResponses = state.botClaims.slice(-4).map(c => c.claim.toLowerCase());
  if (recentResponses.includes(lower)) {
    return {
      score: 0.15,
      type: 'repetitive',
      reason: 'exact same response was just sent',
    };
  }

  // Check for semantic similarity (repeated key phrases)
  const currentPhrases = lower.split(/[.!?]+/).filter(s => s.trim().length > 10);
  for (const recent of recentResponses) {
    const recentPhrases = recent.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const sharedPhrases = currentPhrases.filter(p => 
      recentPhrases.some(rp => {
        // Check if phrases are very similar (>70% overlap)
        const currentWords = p.trim().split(/\s+/);
        const recentWords = rp.trim().split(/\s+/);
        const overlap = currentWords.filter(w => recentWords.includes(w)).length;
        return overlap / Math.max(currentWords.length, recentWords.length) > 0.7;
      })
    );
    if (sharedPhrases.length > 0) {
      return {
        score: 0.25,
        type: 'repetitive',
        reason: `repeated phrase: "${sharedPhrases[0].trim()}"`,
      };
    }
  }

  // Check for generic/template responses
  const genericPatterns = [
    /seems like a good time to/i,
    /^new:/i,
    /catching up/i,
    /let me know/i,
    /happy to help/i,
    /feel free to/i,
    /i appreciate/i,
    /great point/i,
    /interesting perspective/i,
  ];

  for (const pattern of genericPatterns) {
    if (pattern.test(lower)) {
      return {
        score: 0.3,
        type: 'off-brand',
        reason: `generic template language detected: "${lower.match(pattern)?.[0]}"`,
      };
    }
  }

  // Check if user asked a question but response doesn't acknowledge
  const lastUserMsg = messageHistory
    .filter((m) => m.sender.fid !== messageHistory[0]?.sender.fid)
    .slice(-1)[0]?.text.toLowerCase() || "";
  
  const userAskedQuestion = lastUserMsg.includes("?") ||
    /^(why|how|what|when|where|who|which)\b/.test(lastUserMsg);

  if (userAskedQuestion) {
    const questionKeywords = ["because", "since", "that's", "it's", "yeah", "nah", "idk", "i don't", "not sure"];
    const responseAcknowledgesQuestion = questionKeywords.some(kw => lower.includes(kw));
    
    if (!responseAcknowledgesQuestion) {
      return {
        score: 0.4,
        type: 'evasive',
        reason: 'question asked but response doesn\'t acknowledge it',
      };
    }
  }
  
  return { score: 0.9, type: 'strong', reason: 'coherent and on-topic' };
}

/**
 * Legacy function kept for backward compatibility
 * Converts scoreCoherence to boolean format
 */
export function validateCoherence(
  proposedResponse: string,
  messageHistory: ChatMessage[],
  state: ConversationState,
): { isCoherent: boolean; reason?: string } {
  const scoreResult = scoreCoherence(proposedResponse, messageHistory, state);
  return {
    isCoherent: scoreResult.score >= 0.5,
    reason: scoreResult.reason,
  };
}

export function recordBotClaim(
  state: ConversationState,
  message: string,
  messageIndex: number,
): void {
  const topics = extractConversationTopics(message);
  
  state.botClaims.push({
    claim: message,
    messageIndex,
    timestamp: Date.now(),
  });
  
  for (const topic of topics) {
    if (message.includes("not") || message.includes("don't")) {
      state.stanceOnTopics[topic] = "against";
    } else if (message.includes("yes") || message.includes("agree")) {
      state.stanceOnTopics[topic] = "for";
    } else {
      state.stanceOnTopics[topic] = "neutral";
    }
  }
}

/**
 * Record coherence score for memory building
 */
export function recordCoherenceScore(
  state: ConversationState,
  type: string,
  score: number,
): void {
  state.coherenceScores.push({
    type,
    score,
    timestamp: Date.now(),
  });
}
