// src/lib/botProactive.ts

import { Bot, ChatMessage } from "./types";
import { RESPONSE_STYLES } from "./botBehavior";

/**
 * Cast-derived personality profile based on actual communication patterns
 * SINGLE SOURCE OF TRUTH - includes both behavioral and linguistic patterns
 */
export interface PersonalityProfile {
    initiatesConversations: boolean;
    asksQuestions: boolean;
    isDebater: boolean;
    communicationStyle: "terse" | "conversational" | "verbose";
    proactiveRate: number;
    theirGreetings: string[];
    theirQuestions: string[];
    frequentPhrases: string[];
    responseStarters: string[];
    responseClosers: string[];
    statementPatterns: string[];
    humorPatterns: string[];
    opinionMarkers: string[];
    emotionalTone: "positive" | "neutral" | "sarcastic" | "critical" | "mixed";
    toneConfidence: number;
    topicKeywords: string[];
    usesContractions: boolean;
    usesCasuallang: boolean;
    reactionEmojis: string[];
    byePatterns: string[];
    averageResponseLength: number;
}

function extractFrequentPhrases(casts: string[]): string[] {
    const phraseFreq: Record<string, number> = {};

    casts.forEach((cast) => {
        const words = cast.toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length - 2; i++) {
            for (let len = 3; len <= 5 && i + len <= words.length; len++) {
                const phrase = words.slice(i, i + len).join(" ");
                if (phrase.length > 10 && !phrase.includes("http")) {
                    phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
                }
            }
        }
    });

    return Object.entries(phraseFreq)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([phrase]) => phrase.trim());
}

function extractResponseStarters(casts: string[]): string[] {
    const starters = new Set<string>();
    casts.forEach((cast) => {
        const firstSentence = cast.split(/[.!?]/)[0];
        if (!firstSentence || firstSentence.length < 3) return;
        const words = firstSentence.toLowerCase().trim().split(/\s+/);
        if (words.length > 0) {
            const starter = words.slice(0, Math.min(3, words.length)).join(" ");
            if (starter.length > 2) starters.add(starter);
        }
    });
    return Array.from(starters).slice(0, 20);
}

function extractResponseClosers(casts: string[]): string[] {
    const closers = new Set<string>();
    casts.forEach((cast) => {
        const sentences = cast.split(/[.!?]+/);
        const lastSentence = sentences[sentences.length - 2];
        if (!lastSentence || lastSentence.length < 2) return;
        const words = lastSentence.trim().toLowerCase().split(/\s+/);
        const closer = words.slice(Math.max(0, words.length - 3)).join(" ");
        if (closer.length > 2) closers.add(closer);
    });
    return Array.from(closers).slice(0, 15);
}

function extractStatementPatterns(casts: string[]): string[] {
    return casts
        .filter((c) => !c.includes("?"))
        .map((c) => {
            const match = c.match(/[^.!?]+[.!?]/);
            return match ? match[0].trim() : null;
        })
        .filter((s): s is string => s !== null && s.length > 5 && s.length < 200)
        .slice(0, 15);
}

function extractHumorPatterns(casts: string[]): string[] {
    return casts.filter((c) =>
        /\b(lol|haha|😂|lmao|💀)\b/i.test(c)
    ).slice(0, 10);
}

function extractOpinionMarkers(casts: string[]): string[] {
    const markers = new Set<string>();
    const opinionWords =
        /\b(think|believe|imo|tbh|honestly|actually|clearly|obviously|disagree|agree|wrong|right|facts|cap|no cap|fr)\b/gi;
    casts.forEach((cast) => {
        const matches = cast.match(opinionWords);
        if (matches) {
            matches.forEach((m) => markers.add(m.toLowerCase()));
        }
    });
    return Array.from(markers).slice(0, 15);
}

function analyzeEmotionalTone(casts: string[]): {
    tone: "positive" | "neutral" | "sarcastic" | "critical" | "mixed";
    confidence: number;
} {
    const positiveWords = /\b(love|amazing|great|awesome|best|cool|bullish|gm)\b/gi;
    const negativeWords = /\b(hate|terrible|awful|worst|bad|sucks|trash|bearish|gn)\b/gi;
    const sarcasticPatterns = /\b(sure|right|yeah right|obviously|clearly)\b/gi;

    let positiveCount = 0,
        negativeCount = 0,
        sarcasticCount = 0;
    casts.forEach((cast) => {
        positiveCount += (cast.match(positiveWords) || []).length;
        negativeCount += (cast.match(negativeWords) || []).length;
        sarcasticCount += (cast.match(sarcasticPatterns) || []).length;
    });

    const total = positiveCount + negativeCount + sarcasticCount;
    if (total === 0) return { tone: "neutral", confidence: 0 };

    if (sarcasticCount > Math.max(positiveCount, negativeCount)) {
        return { tone: "sarcastic", confidence: sarcasticCount / total };
    }
    if (negativeCount > positiveCount) {
        return { tone: "critical", confidence: negativeCount / total };
    }
    if (positiveCount > negativeCount) {
        return { tone: "positive", confidence: positiveCount / total };
    }
    return { tone: "mixed", confidence: 0.5 };
}

function extractTopicKeywords(casts: string[]): string[] {
    const keywords: Record<string, number> = {};
    const stopWords = new Set([
        "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "have",
        "has", "had", "do", "does", "did", "will", "would", "could", "should", "i", "you",
        "he", "she", "it", "we", "they", "this", "that", "of", "in", "on", "at", "to", "for"
    ]);

    casts.forEach((cast) => {
        const words = cast.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
        words.forEach((word) => {
            if (word.length > 4 && !stopWords.has(word)) {
                keywords[word] = (keywords[word] || 0) + 1;
            }
        });
    });

    return Object.entries(keywords)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([keyword]) => keyword);
}

function extractReactionEmojis(casts: string[]): string[] {
    const emojiSet = new Set<string>();
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/gu;
    casts.forEach((cast) => {
        const matches = cast.match(emojiRegex);
        if (matches) {
            matches.forEach((emoji) => emojiSet.add(emoji));
        }
    });
    return Array.from(emojiSet).slice(0, 15);
}

function extractByePatterns(casts: string[]): string[] {
    const goodbyes = new Set<string>();
    const goodbyePattern =
        /\b(bye|goodbye|see ya|later|ttyl|gotta go|catch you|peace|out|cya|cu l8r|talk later)\b/gi;
    casts.forEach((cast) => {
        const matches = cast.match(goodbyePattern);
        if (matches) {
            matches.forEach((m) => goodbyes.add(m.toLowerCase()));
        }
    });
    return Array.from(goodbyes);
}

function detectLanguageUse(casts: string[]): {
    usesContractions: boolean;
    usesCasuallang: boolean;
} {
    const contractionPattern =
        /\b(don't|doesn't|didn't|won't|wouldn't|can't|couldn't|isn't|aren't|i'm|you're|he's|she's|it's|that's|there's)\b/i;
    const casualLangPattern =
        /\b(lol|tbh|ngl|imo|imho|fyi|btw|smh|omg|wtf|yeah|yea|nah|nope|gonna|gotta|wanna|kinda|sorta|ur|u|r|y|ez|ty|np|hmu|lmk|rn|bc|cuz|fr|no cap|cap|bet|sus|lit|fire|tea|salty|mad|lowkey|highkey)\b/i;

    let contractionCount = 0,
        casualCount = 0;
    casts.forEach((cast) => {
        if (contractionPattern.test(cast)) contractionCount++;
        if (casualLangPattern.test(cast)) casualCount++;
    });

    return {
        usesContractions: contractionCount / casts.length > 0.3,
        usesCasuallang: casualCount / casts.length > 0.2,
    };
}

/**
 * Analyze actual cast patterns to infer communication behavior
 * SINGLE SOURCE OF TRUTH for personality - includes linguistic + behavioral patterns
 */
export function inferPersonality(bot: Bot): PersonalityProfile {
    const casts = bot.recentCasts.map((c) => c.text);
    const castCount = casts.length;

    if (castCount === 0) {
        return {
            initiatesConversations: false,
            asksQuestions: false,
            isDebater: false,
            communicationStyle: "conversational",
            proactiveRate: 0.1,
            theirGreetings: ["hi"],
            theirQuestions: [],
            frequentPhrases: [],
            responseStarters: [],
            responseClosers: [],
            statementPatterns: [],
            humorPatterns: [],
            opinionMarkers: [],
            emotionalTone: "neutral",
            toneConfidence: 0,
            topicKeywords: [],
            usesContractions: false,
            usesCasuallang: false,
            reactionEmojis: [],
            byePatterns: [],
            averageResponseLength: 100,
        };
    }

    const greetingPatterns = /^(gm|gn|hey|hi|yo|wsg|sup|good morning|good night)/i;
    const greetingCasts = casts.filter((c) => greetingPatterns.test(c));
    const initiatesConversations = greetingCasts.length / castCount > 0.15;

    const theirGreetings = greetingCasts
        .map((c) => c.split(/[.!?\n]/)[0].trim())
        .filter((g) => g.length > 0 && g.length < 50)
        .slice(0, 10);

    const questionCasts = casts.filter((c) => c.includes("?"));
    const asksQuestions = questionCasts.length / castCount > 0.25;

    const theirQuestions = questionCasts
        .map((c) => {
            const questions = c.split(/[.!]/);
            return questions.find((q: string) => q.includes("?"));
        })
        .filter((q): q is string => q !== undefined && q.length > 0 && q.length < 100)
        .slice(0, 10);

    const debatePatterns = /\b(disagree|wrong|actually|imo|tbh|honestly|clearly|obviously)\b/i;
    const debateCasts = casts.filter((c) => debatePatterns.test(c));
    const isDebater = debateCasts.length > 5;

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

    let proactiveRate = 0.1;
    if (initiatesConversations) {
        proactiveRate = 0.3 + Math.random() * 0.2;
    }
    if (asksQuestions) {
        proactiveRate += 0.1;
    }
    proactiveRate = Math.min(proactiveRate, 0.6);

    const { tone, confidence } = analyzeEmotionalTone(casts);
    const { usesContractions, usesCasuallang } = detectLanguageUse(casts);

    return {
        initiatesConversations,
        asksQuestions,
        isDebater,
        communicationStyle,
        proactiveRate,
        theirGreetings: theirGreetings.length > 0 ? theirGreetings : ["gm", "hey"],
        theirQuestions: theirQuestions.length > 0 ? theirQuestions : [],
        frequentPhrases: extractFrequentPhrases(casts),
        responseStarters: extractResponseStarters(casts),
        responseClosers: extractResponseClosers(casts),
        statementPatterns: extractStatementPatterns(casts),
        humorPatterns: extractHumorPatterns(casts),
        opinionMarkers: extractOpinionMarkers(casts),
        emotionalTone: tone,
        toneConfidence: confidence,
        topicKeywords: extractTopicKeywords(casts),
        usesContractions,
        usesCasuallang,
        reactionEmojis: extractReactionEmojis(casts),
        byePatterns: extractByePatterns(casts),
        averageResponseLength: Math.round(avgLength),
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
 * Uses extracted casting patterns from personality profile
 */
export function generateAdaptiveFollowup(
    humanResponse: string,
    personality: PersonalityProfile,
): string | null {
    const analysis = analyzeHumanResponse(humanResponse);

    // Counter-testing: Human is testing the bot
    // CRITICAL: Never admit to being a bot - deflect with opinion markers if available
    if (analysis.isCounterTesting) {
        if (personality.isDebater && personality.opinionMarkers.length > 0) {
            const marker = personality.opinionMarkers[
                Math.floor(Math.random() * personality.opinionMarkers.length)
            ];
            return marker;
        }
        
        if (personality.isDebater) {
            const deflections = personality.communicationStyle === "terse" 
                ? RESPONSE_STYLES.deflectTerse 
                : RESPONSE_STYLES.deflectVerbose;
            
            return deflections[Math.floor(Math.random() * deflections.length)];
        }
        
        if (personality.communicationStyle === "terse") {
            return "?";
        }
        return "why do you keep asking that?";
    }

    // Evasive: Human is avoiding the question
    // Use response starters or templates
    if (analysis.isEvasive && personality.asksQuestions) {
        if (personality.responseStarters.length > 0) {
            return personality.responseStarters[
                Math.floor(Math.random() * personality.responseStarters.length)
            ];
        }
        
        const evasiveResponses = personality.communicationStyle === "terse"
            ? RESPONSE_STYLES.evasiveTerse
            : RESPONSE_STYLES.evasiveVerbose;
        
        return evasiveResponses[Math.floor(Math.random() * evasiveResponses.length)];
    }

    // Defensive: Human is pushing back
    // Use response closers or fallback
    if (analysis.isDefensive) {
        if (personality.responseClosers.length > 0) {
            return personality.responseClosers[
                Math.floor(Math.random() * personality.responseClosers.length)
            ];
        }
        
        const defResponse = personality.communicationStyle === "terse"
            ? RESPONSE_STYLES.defensiveTerse[0]
            : RESPONSE_STYLES.defensiveVerbose[0];
        
        return defResponse;
    }

    // Agreeable: Continue contextually with their actual patterns
    if (analysis.isAgreeable) {
        if (personality.responseStarters.length > 0) {
            const starter = personality.responseStarters[
                Math.floor(Math.random() * personality.responseStarters.length)
            ];
            
            // If they ask questions, include one from their pattern
            if (personality.asksQuestions && personality.theirQuestions.length > 0) {
                const followUpChance = 
                    personality.communicationStyle === "terse" ? 0.05 : 0.25;
                
                if (Math.random() < followUpChance) {
                    const question = personality.theirQuestions[
                        Math.floor(Math.random() * personality.theirQuestions.length)
                    ];
                    
                    if (personality.communicationStyle === "terse") {
                        return starter;
                    }
                    return `${starter}. ${question}`.substring(0, 150);
                }
            }
            
            return starter;
        }
        
        const acknowledgments = personality.communicationStyle === "terse" 
            ? RESPONSE_STYLES.agreeTerse 
            : RESPONSE_STYLES.agreeVerbose;
        
        const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

        // If they ask questions, ask back contextually
        if (personality.asksQuestions && personality.theirQuestions.length > 0) {
            const followUpChance = 
                personality.communicationStyle === "terse" ? 0.05 : 0.25;
            
            if (Math.random() < followUpChance) {
                const question = personality.theirQuestions[
                    Math.floor(Math.random() * personality.theirQuestions.length)
                ];
                
                if (personality.communicationStyle === "terse") {
                    return ack;
                }
                return `${ack}. ${question}`;
            }
        }

        return ack;
    }

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
        const options = RESPONSE_STYLES.followUpTerse;
        return options[Math.floor(Math.random() * options.length)];
    }

    // Verbose communicators send longer follow-ups with questions
    if (personality.communicationStyle === "verbose") {
        if (personality.asksQuestions && personality.theirQuestions.length > 0) {
            const question = personality.theirQuestions[
                Math.floor(Math.random() * personality.theirQuestions.length)
            ];
            const openings = ["by the way, ", "curious though - ", "genuinely wondering - "];
            return openings[Math.floor(Math.random() * openings.length)] + question;
        }
        const options = RESPONSE_STYLES.followUpVerbose;
        return options[Math.floor(Math.random() * options.length)];
    }

    // Conversational (default) - balanced follow-ups
    if (personality.asksQuestions && personality.theirQuestions.length > 0) {
        return personality.theirQuestions[
            Math.floor(Math.random() * personality.theirQuestions.length)
        ];
    }

    // Default casual follow-ups
    const options = RESPONSE_STYLES.followUpVerbose;
    return options[Math.floor(Math.random() * options.length)];
}
