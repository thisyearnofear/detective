#!/usr/bin/env node

/**
 * Test script to check Neynar API connectivity
 */

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

async function testNeynarAPI(username) {
    console.log(`🔍 Testing Neynar API for username: ${username}\n`);

    if (!NEYNAR_API_KEY) {
        console.log('⚠️  NEYNAR_API_KEY not set in environment');
        console.log('   App will use mock data\n');
        return null;
    }

    console.log('✅ API Key found:', NEYNAR_API_KEY.substring(0, 8) + '...\n');

    try {
        // Test 1: Lookup username
        console.log('📡 Step 1: Looking up username...');
        const userLookupResponse = await fetch(
            `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'api_key': NEYNAR_API_KEY,
                },
            }
        );

        console.log('   Status:', userLookupResponse.status);

        if (!userLookupResponse.ok) {
            const errorText = await userLookupResponse.text();
            console.log('   Error:', errorText);
            return null;
        }

        const userData = await userLookupResponse.json();
        const user = userData.user || userData.result?.user;

        const fid = user?.fid;
        const displayName = user?.display_name;
        const pfpUrl = user?.pfp_url;

        console.log('   ✅ Found user!');
        console.log('   FID:', fid);
        console.log('   Display Name:', displayName);
        console.log('   PFP:', pfpUrl?.substring(0, 50) + '...');
        console.log('');

        // Test 2: Fetch user's casts
        console.log('📡 Step 2: Fetching recent casts...');
        const feedResponse = await fetch(
            `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}&limit=15`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'api_key': NEYNAR_API_KEY,
                },
            }
        );

        console.log('   Status:', feedResponse.status);

        if (!feedResponse.ok) {
            const errorText = await feedResponse.text();
            console.log('   Error:', errorText);
            return null;
        }

        const feedData = await feedResponse.json();
        const casts = feedData.casts || [];

        console.log('   ✅ Found', casts.length, 'casts');
        console.log('');

        if (casts.length > 0) {
            console.log('📝 Sample casts:');
            casts.slice(0, 3).forEach((cast, i) => {
                const text = cast.text?.substring(0, 80) || '';
                console.log(`   ${i + 1}. "${text}${text.length >= 80 ? '...' : ''}"`);
            });
            console.log('');
        }

        return { fid, displayName, pfpUrl, casts };
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

async function main() {
    const username = process.argv[2] || 'dwr';

    console.log('🎮 Detective Game - Neynar API Test\n');
    console.log('='.repeat(50));
    console.log('');

    await testNeynarAPI(username);

    console.log('='.repeat(50));
    console.log('✅ Test complete!\n');
}

main().catch(console.error);
