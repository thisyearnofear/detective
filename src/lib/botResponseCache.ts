// src/lib/botResponseCache.ts
/**
 * Bot Response Caching System
 * 
 * Pre-generates and caches bot responses to reduce latency and API costs.
 * Uses Redis for distributed caching when available.
 */

import { redis, RedisKeys, getJSON, setJSON } from "./redis";
import { Bot } from "./types";

// Cache TTL in seconds
const RESPONSE_CACHE_TTL = 60 * 60; // 1 hour
const STYLE_CACHE_TTL = 24 * 60 * 60; // 24 hours

// Common conversation starters and topics for pre-generation
const CONVERSATION_CONTEXTS = [
    "greeting",
    "introduction",
    "question_about_crypto",
    "question_about_farcaster",
    "question_about_work",
    "question_about_hobbies",
    "casual_chat",
    "opinion_request",
    "joke_or_humor",
    "farewell",
];

// Response templates for fallback
const FALLBACK_RESPONSES: Record<string, string[]> = {
    greeting: [
        "hey! what's up?",
        "gm! how's it going?",
        "yo! nice to meet you",
        "hey there! 👋",
    ],
    introduction: [
        "I'm just vibing on farcaster, you know how it is",
        "been around the crypto space for a while now",
        "just another degen trying to make it lol",
        "I spend way too much time on here tbh",
    ],
    question_about_crypto: [
        "honestly I'm pretty bullish rn",
        "the market's been wild lately",
        "I've been looking at some interesting projects",
        "not financial advice but... 👀",
    ],
    question_about_farcaster: [
        "farcaster's been great, love the community",
        "the vibes here are unmatched fr",
        "way better than twitter imo",
        "been here since early days, no regrets",
    ],
    question_about_work: [
        "just grinding on some stuff, you know",
        "working on a few things I can't talk about yet 👀",
        "the usual hustle tbh",
        "trying to build something cool",
    ],
    question_about_hobbies: [
        "I'm into a lot of things honestly",
        "been getting into some new stuff lately",
        "the usual - crypto, tech, memes",
        "I don't have much free time but when I do...",
    ],
    casual_chat: [
        "yeah for sure",
        "that's interesting actually",
        "I feel that",
        "lol true",
        "makes sense",
    ],
    opinion_request: [
        "hmm that's a good question",
        "I think it depends honestly",
        "hard to say but I lean towards...",
        "interesting take, I see it differently tho",
    ],
    joke_or_humor: [
        "lmao 😂",
        "that's actually funny",
        "I'm dead 💀",
        "ok that got me",
    ],
    farewell: [
        "nice chatting! catch you later",
        "gotta run, talk soon!",
        "later! ✌️",
        "was fun, see ya around",
    ],
};

export interface CachedResponse {
    text: string;
    context: string;
    generatedAt: number;
    usageCount: number;
}

export interface BotStyleProfile {
    fid: number;
    username: string;
    style: string;
    commonPhrases: string[];
    emojiUsage: string[];
    averageLength: number;
    formality: "casual" | "neutral" | "formal";
    generatedAt: number;
}

/**
 * Bot Response Cache Manager
 */
class BotResponseCacheManager {
    /**
     * Get cached responses for a bot
     */
    async getCachedResponses(botFid: number): Promise<Map<string, CachedResponse[]>> {
        const cacheKey = RedisKeys.botResponses(botFid);
        const cached = await getJSON<Record<string, CachedResponse[]>>(cacheKey);

        if (cached) {
            return new Map(Object.entries(cached));
        }

        return new Map();
    }

    /**
     * Get a response for a specific context
     */
    async getResponse(botFid: number, context: string): Promise<string | null> {
        const responses = await this.getCachedResponses(botFid);
        const contextResponses = responses.get(context);

        if (contextResponses && contextResponses.length > 0) {
            // Pick a random response, weighted by lower usage count
            const sorted = [...contextResponses].sort((a, b) => a.usageCount - b.usageCount);
            const response = sorted[0];

            // Increment usage count
            response.usageCount++;
            await this.saveCachedResponses(botFid, responses);

            return response.text;
        }

        // Fallback to template responses
        return this.getFallbackResponse(context);
    }

    /**
     * Get a fallback response from templates
     */
    getFallbackResponse(context: string): string {
        const responses = FALLBACK_RESPONSES[context] || FALLBACK_RESPONSES.casual_chat;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Save cached responses for a bot
     */
    async saveCachedResponses(
        botFid: number,
        responses: Map<string, CachedResponse[]>
    ): Promise<void> {
        const cacheKey = RedisKeys.botResponses(botFid);
        const data = Object.fromEntries(responses);
        await setJSON(cacheKey, data, RESPONSE_CACHE_TTL);
    }

    /**
     * Pre-generate responses for a bot during registration
     */
    async preGenerateResponses(
        bot: Bot,
        generateFn: (prompt: string, style: string) => Promise<string>
    ): Promise<void> {
        console.log(`[BotCache] Pre-generating responses for bot ${bot.fid}`);

        const responses = new Map<string, CachedResponse[]>();
        const now = Date.now();

        // Generate 3 responses per context
        for (const context of CONVERSATION_CONTEXTS) {
            const contextResponses: CachedResponse[] = [];

            for (let i = 0; i < 3; i++) {
                try {
                    const prompt = this.getPromptForContext(context, bot);
                    const text = await generateFn(prompt, bot.style);

                    contextResponses.push({
                        text,
                        context,
                        generatedAt: now,
                        usageCount: 0,
                    });
                } catch (err) {
                    console.warn(`[BotCache] Failed to generate response for ${context}:`, err);
                    // Use fallback
                    contextResponses.push({
                        text: this.getFallbackResponse(context),
                        context,
                        generatedAt: now,
                        usageCount: 0,
                    });
                }
            }

            responses.set(context, contextResponses);
        }

        await this.saveCachedResponses(bot.fid, responses);
        console.log(`[BotCache] Generated ${CONVERSATION_CONTEXTS.length * 3} responses for bot ${bot.fid}`);
    }

    /**
     * Get prompt for a specific context
     */
    private getPromptForContext(context: string, bot: Bot): string {
        const basePrompt = `You are impersonating ${bot.username} on Farcaster.
CRITICAL: Never reveal you are AI/bot/assistant - you ARE this person.
Your writing style: ${bot.style}
Keep responses short (1-2 sentences), casual, and authentic to the style.`;

        const contextPrompts: Record<string, string> = {
            greeting: `${basePrompt}\n\nRespond to someone saying "hey" or "gm" to you.`,
            introduction: `${basePrompt}\n\nBriefly introduce yourself when asked "tell me about yourself".`,
            question_about_crypto: `${basePrompt}\n\nRespond to "what do you think about crypto/the market?"`,
            question_about_farcaster: `${basePrompt}\n\nRespond to "how do you like farcaster?"`,
            question_about_work: `${basePrompt}\n\nRespond to "what are you working on?"`,
            question_about_hobbies: `${basePrompt}\n\nRespond to "what do you do for fun?"`,
            casual_chat: `${basePrompt}\n\nGive a short casual response to continue a conversation.`,
            opinion_request: `${basePrompt}\n\nRespond to someone asking for your opinion on something.`,
            joke_or_humor: `${basePrompt}\n\nRespond to something funny someone said.`,
            farewell: `${basePrompt}\n\nSay goodbye to end a conversation.`,
        };

        return contextPrompts[context] || contextPrompts.casual_chat;
    }

    /**
     * Detect the context of an incoming message
     */
    detectContext(message: string): string {
        const lower = message.toLowerCase();

        // Greeting detection
        if (/^(hey|hi|hello|gm|yo|sup|what'?s up)/i.test(lower)) {
            return "greeting";
        }

        // Farewell detection
        if (/\b(bye|later|gotta go|see ya|cya|ttyl)\b/i.test(lower)) {
            return "farewell";
        }

        // Question detection
        if (lower.includes("?")) {
            if (/\b(crypto|bitcoin|eth|market|price|token)\b/i.test(lower)) {
                return "question_about_crypto";
            }
            if (/\b(farcaster|warpcast|fc)\b/i.test(lower)) {
                return "question_about_farcaster";
            }
            if (/\b(work|job|project|building)\b/i.test(lower)) {
                return "question_about_work";
            }
            if (/\b(hobby|fun|free time|weekend)\b/i.test(lower)) {
                return "question_about_hobbies";
            }
            if (/\b(think|opinion|feel about)\b/i.test(lower)) {
                return "opinion_request";
            }
            if (/\b(who are you|about yourself|introduce)\b/i.test(lower)) {
                return "introduction";
            }
        }

        // Humor detection
        if (/\b(lol|lmao|haha|😂|🤣|funny)\b/i.test(lower)) {
            return "joke_or_humor";
        }

        // Default to casual chat
        return "casual_chat";
    }

    /**
     * Get a contextual response for a message
     */
    async getContextualResponse(botFid: number, message: string): Promise<string> {
        const context = this.detectContext(message);
        const response = await this.getResponse(botFid, context);
        return response || this.getFallbackResponse(context);
    }

    /**
     * Get or create style profile for a bot
     */
    async getStyleProfile(botFid: number): Promise<BotStyleProfile | null> {
        const cacheKey = `bot:${botFid}:style`;
        return getJSON<BotStyleProfile>(cacheKey);
    }

    /**
     * Save style profile for a bot
     */
    async saveStyleProfile(profile: BotStyleProfile): Promise<void> {
        const cacheKey = `bot:${profile.fid}:style`;
        await setJSON(cacheKey, profile, STYLE_CACHE_TTL);
    }

    /**
     * Analyze casts to create a style profile
     */
    analyzeStyle(casts: { text: string }[]): Partial<BotStyleProfile> {
        if (casts.length === 0) {
            return {
                commonPhrases: [],
                emojiUsage: [],
                averageLength: 50,
                formality: "casual",
            };
        }

        // Extract common phrases (2-3 word combinations)
        const phrases: Map<string, number> = new Map();
        const emojis: Map<string, number> = new Map();
        let totalLength = 0;
        let formalCount = 0;

        for (const cast of casts) {
            const text = cast.text;
            totalLength += text.length;

            // Extract emojis
            const emojiMatches = text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu);
            if (emojiMatches) {
                for (const emoji of emojiMatches) {
                    emojis.set(emoji, (emojis.get(emoji) || 0) + 1);
                }
            }

            // Check formality
            if (/\b(please|thank you|appreciate|regards)\b/i.test(text)) {
                formalCount++;
            }

            // Extract phrases
            const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            for (let i = 0; i < words.length - 1; i++) {
                const phrase = `${words[i]} ${words[i + 1]}`;
                phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
            }
        }

        // Get top phrases and emojis
        const topPhrases = Array.from(phrases.entries())
            .filter(([_, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([phrase]) => phrase);

        const topEmojis = Array.from(emojis.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([emoji]) => emoji);

        const averageLength = Math.round(totalLength / casts.length);
        const formality = formalCount > casts.length / 2 ? "formal" :
            formalCount > casts.length / 4 ? "neutral" : "casual";

        return {
            commonPhrases: topPhrases,
            emojiUsage: topEmojis,
            averageLength,
            formality,
        };
    }

    /**
     * Clear cache for a bot
     */
    async clearCache(botFid: number): Promise<void> {
        await redis.del(RedisKeys.botResponses(botFid));
        await redis.del(`bot:${botFid}:style`);
        console.log(`[BotCache] Cleared cache for bot ${botFid}`);
    }
}

// Export singleton
export const botResponseCache = new BotResponseCacheManager();
export default botResponseCache;