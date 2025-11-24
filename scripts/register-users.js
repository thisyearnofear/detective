#!/usr/bin/env node

/**
 * Test script to register users via the bulk registration API
 */

const PORT = process.env.PORT || 4949;
const BASE_URL = `http://localhost:${PORT}`;

async function registerUsers(usernames) {
    console.log('📝 Registering users...\n');
    console.log('Usernames:', usernames.join(', '));
    console.log('');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/register-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames }),
        });

        const data = await response.json();

        console.log('📊 Registration Results:');
        console.log('  Status:', response.status);
        console.log('  Success:', data.success);
        console.log('  Registered:', data.registered);
        console.log('  Failed:', data.failed);
        console.log('');

        if (data.results && data.results.length > 0) {
            console.log('✅ Successfully Registered:');
            data.results.forEach((result, i) => {
                console.log(`  ${i + 1}. ${result.username} (FID: ${result.fid})`);
            });
            console.log('');
        }

        if (data.errors && data.errors.length > 0) {
            console.log('❌ Failed Registrations:');
            data.errors.forEach((error, i) => {
                console.log(`  ${i + 1}. ${error.username}: ${error.error}`);
            });
            console.log('');
        }

        return data;
    } catch (error) {
        console.error('❌ Error during registration:', error.message);
        return null;
    }
}

async function main() {
    const usernames = process.argv.slice(2);

    if (usernames.length === 0) {
        console.log('❌ No usernames provided!\n');
        console.log('Usage: node scripts/register-users.js <username1> <username2> ...\n');
        console.log('Example: node scripts/register-users.js dwr v papa\n');
        process.exit(1);
    }

    console.log('🎮 Detective Game - User Registration\n');
    console.log(`Testing against: ${BASE_URL}\n`);
    console.log('='.repeat(50));
    console.log('');

    await registerUsers(usernames);

    console.log('='.repeat(50));
    console.log('✅ Registration complete!\n');
    console.log('💡 Run: node scripts/check-state.js to verify\n');
}

main().catch(console.error);
