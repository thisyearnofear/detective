#!/usr/bin/env node

/**
 * Test script to check Venice API connectivity
 */

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

async function testVeniceAPI() {
    console.log('🧠 Testing Venice API...\n');

    if (!VENICE_API_KEY) {
        console.log('⚠️  VENICE_API_KEY not set in environment');
        return;
    }

    console.log('✅ API Key found:', VENICE_API_KEY.substring(0, 8) + '...\n');

    const systemPrompt = "You are a helpful assistant.";
    const userContent = "Say 'Hello from Venice!' if you can hear me.";

    try {
        console.log('📡 Sending request to Venice...');
        const response = await fetch(VENICE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${VENICE_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b", // Correct model name
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                ],
            }),
        });

        console.log('   Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('   Error:', errorText);
            return;
        }

        const data = await response.json();
        console.log('   Response:', JSON.stringify(data, null, 2));

        const content = data.choices?.[0]?.message?.content;
        console.log('\n✅ Result:', content);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function main() {
    console.log('🎮 Detective Game - Venice API Test\n');
    console.log('='.repeat(50));
    console.log('');

    await testVeniceAPI();

    console.log('='.repeat(50));
    console.log('✅ Test complete!\n');
}

main().catch(console.error);
