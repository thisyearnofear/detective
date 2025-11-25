// src/lib/botProactive.ts

import { Bot, ChatMessage } from "./types";

/**
 * Cast-derived personality profile based on actual communication patterns
 * NOT based on status/followers - based on how they actually communicate
 */
export interface PersonalityProfile {
    initiatesConversations: boolean; // Do they start threads/post greetings?
    asksQuestions: boolean; // High question frequency in casts
    isDebater: boolean; // Uses disagreement/opinion phrases
    communicationStyle: "terse" | "conversational" | "verbose";
    proactiveRate: number; // 0.0 to 1.0 - derived from their actual behavior
    theirGreetings: string[]; // Their actual greeting patterns
    theirQuestions: string[]; // Their actual question patterns
}

/**
 * Analyze actual cast patterns to infer communication behavior
 * This is the SINGLE SOURCE OF TRUTH for personality
 */
export function inferPersonality(bot: Bot): PersonalityProfile {
    const casts = bot.recentCasts.map((c) => c.text);
    const castCount = casts.length;

    if (castCount === 0) {
        // Fallback for users with no casts
        return {
            initiatesConversations: false,
            asksQuestions: false,
            isDebater: false,
            communicationStyle: "conversational",
            proactiveRate: 0.1,
            theirGreetings: ["hi"],
            theirQuestions: [],
        };
    }

    // 1. Do they initiate conversations?
    const greetingPatterns = /^(gm|gn|hey|hi|yo|wsg|sup|good morning|good night)/i;
    const greetingCasts = casts.filter((c) => greetingPatterns.test(c));
    const initiatesConversations = greetingCasts.length / castCount > 0.15; // 15%+ of casts are greetings

    // Extract their actual greetings for reuse
    const theirGreetings = greetingCasts
        .map((c) => c.split(/[.!?\n]/)[0].trim()) // First sentence
        .filter((g) => g.length > 0 && g.length < 50)
        .slice(0, 10); // Keep top 10

    // 2. Do they ask questions?
    const questionCasts = casts.filter((c) => c.includes("?"));
    const asksQuestions = questionCasts.length / castCount > 0.25; // 25%+ are questions

    // Extract their actual questions for reuse
    const theirQuestions = questionCasts
        .map((c) => {
            // Extract just the question part
            const questions = c.split(/[.!]/);
            return questions.find((q: string) => q.includes("?"));
        })
        .filter((q): q is string => q !== undefined && q.length > 0 && q.length < 100)
        .slice(0, 10); // Keep top 10

    // 3. Are they a debater/opinionated?
    const debatePatterns = /\b(disagree|wrong|actually|imo|tbh|honestly|clearly|obviously)\b/i;
    const debateCasts = casts.filter((c) => debatePatterns.test(c));
    const isDebater = debateCasts.length > 5; // Absolute count, not ratio

    // 4. Communication style based on average length
    const totalLength = casts.reduce((sum, c) => sum + c.length, 0);
    const avgLength = totalLength / castCount;
    let communicationStyle: "terse" | "conversational" | "verbose";
    if (avgLength < 50) {
        communicationStyle = "terse";
    } else if (avgLength < 150) {
        communicationStyle = "conversational";
    } else {
        communicationStyle = "verbose";
    }

    // 5. Calculate proactive rate based on THEIR behavior
    // If they often start conversations, they're more likely to initiate
    let proactiveRate = 0.1; // Base 10%
    if (initiatesConversations) {
        proactiveRate = 0.3 + Math.random() * 0.2; // 30-50%
    }
    if (asksQuestions) {
        proactiveRate += 0.1; // Bonus for curious people
    }
    proactiveRate = Math.min(proactiveRate, 0.6); // Cap at 60%

    return {
        initiatesConversations,
        asksQuestions,
        isDebater,
        communicationStyle,
        proactiveRate,
        theirGreetings: theirGreetings.length > 0 ? theirGreetings : ["gm", "hey"],
        theirQuestions: theirQuestions.length > 0 ? theirQuestions : [],
    };
}

/**
 * Generate a proactive opening using THEIR actual communication patterns
 */
export function generateProactiveOpening(
    personality: PersonalityProfile,
): string | null {
    // Roll for proactivity based on their actual behavior
    if (Math.random() > personality.proactiveRate) {
        return null; // Bot waits for human
    }

    // Use one of THEIR actual greetings
    if (personality.theirGreetings.length > 0) {
        return personality.theirGreetings[
            Math.floor(Math.random() * personality.theirGreetings.length)
        ];
    }

    // Fallback to simple greeting
    return "gm";
}

/**
 * Analyze human response for behavioral cues
 */
export function analyzeHumanResponse(message: string): {
    isEvasive: boolean;
    isDefensive: boolean;
    isCounterTesting: boolean;
    isAgreeable: boolean;
} {
    const lower = message.toLowerCase();

    return {
        isEvasive: /i don't know|maybe|not sure|idk|dunno/.test(lower),
        isDefensive: /why do you ask|what about you|you first|why\?/.test(lower),
        isCounterTesting: /are you|bot or human|prove|real or|human or bot/.test(
            lower,
        ),
        isAgreeable: /yeah|yes|true|agree|same|lol|haha/.test(lower),
    };
}

/**
 * Generate adaptive follow-up based on human behavior and bot's personality
 */
export function generateAdaptiveFollowup(
    humanResponse: string,
    personality: PersonalityProfile,
): string | null {
    const analysis = analyzeHumanResponse(humanResponse);

    // Counter-testing: Human is testing the bot
    if (analysis.isCounterTesting) {
        // If they're a debater, push back
        if (personality.isDebater) {
            const responses = [
                "lol good question, i am a bot", // Reverse psychology
                "why do you say that?",
                "you're deflecting",
                "classic bot response tbh",
                "that's what a bot would ask",
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }
        // Otherwise, be more casual
        return Math.random() < 0.5 ? "interesting question" : "what makes you ask?";
    }

    // Evasive: Human is avoiding the question
    if (analysis.isEvasive && personality.asksQuestions) {
        const responses = ["sus", "hmm", "interesting..."];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Defensive: Human is pushing back
    if (analysis.isDefensive) {
        const responses = ["just curious", "fair question", "why not?"];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Agreeable: Continue naturally
    if (analysis.isAgreeable) {
        const responses = ["yeah fr", "right?", "exactly", "lol yeah", "true"];
        const response =
            responses[Math.floor(Math.random() * responses.length)];

        // If they ask questions, add a follow-up
        if (
            personality.asksQuestions &&
            personality.theirQuestions.length > 0 &&
            Math.random() < 0.3
        ) {
            const question =
                personality.theirQuestions[
                Math.floor(Math.random() * personality.theirQuestions.length)
                ];
            return `${response}. ${question}`;
        }

        return response;
    }

    // No specific pattern detected - let normal response generation handle it
    return null;
}

/**
 * Determine if bot should send a proactive follow-up (double-texting)
 * Only if they actually do this in their casts
 */
export function shouldSendProactiveFollowup(
    messageHistory: ChatMessage[],
    personality: PersonalityProfile,
    timeSinceLastMessage: number,
): boolean {
    // Only if they're naturally proactive
    if (!personality.initiatesConversations) return false;

    // Don't send if conversation just started
    if (messageHistory.length < 2) return false;

    // Don't send if human just sent a message
    const lastMessage = messageHistory[messageHistory.length - 1];
    if (lastMessage.sender.fid !== messageHistory[0].sender.fid) return false;

    // Don't send if it's been too long (conversation died)
    if (timeSinceLastMessage > 30000) return false; // 30 seconds

    // Low chance, only for very proactive people
    return Math.random() < personality.proactiveRate * 0.2; // 20% of their proactive rate
}

/**
 * Generate a proactive follow-up message (double-texting)
 * Use their actual communication style
 */
export function generateProactiveFollowupMessage(
    personality: PersonalityProfile,
): string {
    // Terse communicators send short follow-ups
    if (personality.communicationStyle === "terse") {
        const options = ["?", "...", "yo", "hello?"];
        return options[Math.floor(Math.random() * options.length)];
    }

    // Questioners ask follow-ups
    if (personality.asksQuestions && personality.theirQuestions.length > 0) {
        return personality.theirQuestions[
            Math.floor(Math.random() * personality.theirQuestions.length)
        ];
    }

    // Default casual follow-ups
    const options = ["you there?", "lol", "hmm", "interesting"];
    return options[Math.floor(Math.random() * options.length)];
}
