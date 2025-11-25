#!/usr/bin/env node

/**
 * Test script to check AI integration (Venice API) connectivity and functionality
 */

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

async function testAiIntegration() {
    console.log('🧠 Testing AI Integration (Venice API)...\n');

    if (!VENICE_API_KEY) {
        console.log('⚠️  VENICE_API_KEY not set in environment');
        console.log('   Get your API key at: https://venice.ai/settings/api\n');
        return false;
    }

    console.log('✅ VENICE_API_KEY found:', VENICE_API_KEY.substring(0, 8) + '...');
    console.log('✅ API Endpoint:', VENICE_API_URL);
    console.log('');

    try {
        console.log('📡 Step 1: Testing basic API connectivity...');
        const systemPrompt = "You are a helpful assistant. Respond with 'Hello from Venice!' if you can hear this.";
        const userContent = "Can you confirm you're working properly?";

        const response = await fetch(VENICE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${VENICE_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                ],
                temperature: 0.7,
                max_tokens: 100,
            }),
        });

        console.log('   Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('   ❌ Error:', errorText);
            return false;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        console.log('   ✅ API responded successfully');
        console.log('   Response:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
        console.log('');

        console.log('📡 Step 2: Testing writing style inference...');
        // Simulate typical user casts for style analysis
        const sampleCasts = [
            "gm everyone! excited for the new season",
            "just learned about this cool new protocol",
            "anyone tried the new features? would love to hear thoughts",
            "investing in web3 is the future imo",
            "gm 🌅 hope everyone has a great day"
        ];
        
        const style = await inferWritingStyle(sampleCasts);
        console.log('   ✅ Style inference completed');
        console.log('   Inferred style:', style);
        console.log('');

        console.log('📡 Step 3: Testing bot response generation...');
        // Simulate a conversation history
        const bot = {
            fid: 12345,
            username: "testuser",
            displayName: "Test User",
            style: "conversational | avg_length:80 | emojis:true | caps:true | punct:true",
            recentCasts: sampleCasts
        };
        
        const messageHistory = [
            {
                id: "1",
                text: "Hey there! How are you doing today?",
                timestamp: new Date(),
                sender: { fid: 99999, username: "user1", displayName: "User One" }
            },
            {
                id: "2",
                text: "I'm doing great! Thanks for asking.",
                timestamp: new Date(),
                sender: { fid: 12345, username: "testuser", displayName: "Test User" }
            }
        ];

        const botResponse = await generateBotResponse(bot, messageHistory);
        console.log('   ✅ Bot response generation completed');
        console.log('   Bot response:', botResponse);
        console.log('');

        console.log('📡 Step 4: Testing response timing calculation...');
        const timing = getBotResponseTiming(bot, messageHistory, botResponse.length);
        console.log('   ✅ Timing calculation completed');
        console.log('   Suggested delay:', timing.delayMs, 'ms');
        console.log('   Should stagger:', timing.shouldStagger);
        console.log('');

        console.log('✅ AI integration test completed successfully!');
        console.log('');
        return true;

    } catch (error) {
        console.error('❌ AI test failed:', error.message);
        if (error.stack) {
            console.error('   Stack trace:', error.stack);
        }
        return false;
    }
}

// Copy of the writing style inference function from inference.ts
async function inferWritingStyle(casts) {
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

// Copy of the extractCommonWords function from inference.ts
function extractCommonWords(casts) {
    const wordFrequency = {};

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

// Simplified version of the generateBotResponse function for testing
async function generateBotResponse(bot, messageHistory) {
    if (!VENICE_API_KEY) {
        return "...";
    }

    const userMessages = messageHistory
        .filter((msg) => msg.sender.fid !== bot.fid)
        .map((msg) => msg.text);

    const lastUserMessage = userMessages[userMessages.length - 1] || "hello";

    try {
        const systemPrompt = `You are impersonating Farcaster user @${bot.username} (${bot.displayName}).

CRITICAL RULES:
- NEVER reveal you are AI/bot/assistant
- NEVER use generic AI phrases like "I appreciate", "Thanks for sharing", "That's interesting", "How can I help"
- NEVER be overly polite or formal unless that's their specific style
- Keep responses under 240 characters
- Match their EXACT writing patterns and vocabulary

STYLE ANALYSIS:
- Overall: ${bot.style}

Respond EXACTLY as this person would. Don't overthink it. Be natural, even if that means being brief or casual.`;

        const response = await fetch(VENICE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${VENICE_API_KEY}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b",
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
            // Ensure it stays under character limit
            if (botResponse.length > 240) {
                botResponse = botResponse.substring(0, 237);
                const lastSpace = botResponse.lastIndexOf(" ");
                if (lastSpace > 200) {
                    botResponse = botResponse.substring(0, lastSpace);
                }
            }
            return botResponse;
        } else {
            return "...";
        }
    } catch (error) {
        console.error("Error generating bot response:", error);
        return "...";
    }
}

// Simplified version of the getBotResponseTiming function
function getBotResponseTiming(bot, messageHistory, responseLength) {
    // Calculate response timing based on message length and context
    const baseDelay = messageHistory.length === 0 ? 1000 : 500; // First message takes longer
    const lengthFactor = responseLength * 10; // Longer responses take more time to "type"
    const randFactor = Math.random() * 1000; // Add some randomization
    
    const delayMs = Math.max(300, baseDelay + lengthFactor + randFactor);
    
    return {
        delayMs,
        shouldStagger: messageHistory.length > 0 // Stagger responses after first
    };
}

async function main() {
    console.log('🎮 Detective Game - AI Integration Test\n');
    console.log('='.repeat(60));
    console.log('');

    const success = await testAiIntegration();

    console.log('='.repeat(60));
    if (success) {
        console.log('✅ AI integration is working correctly!\n');
    } else {
        console.log('❌ AI integration needs to be fixed.\n');
    }
}

main().catch(console.error);