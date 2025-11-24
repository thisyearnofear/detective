#!/usr/bin/env node

/**
 * Test script to check game state and registered users
 */

const PORT = process.env.PORT || 4949;
const BASE_URL = `http://localhost:${PORT}`;

async function checkGameState() {
    console.log('🔍 Checking game state...\n');

    try {
        const response = await fetch(`${BASE_URL}/api/game/status`);
        const data = await response.json();

        console.log('📊 Game Status:');
        console.log('  State:', data.state);
        console.log('  Player Count:', data.playerCount);
        console.log('  Cycle ID:', data.cycleId);
        console.log('');

        return data;
    } catch (error) {
        console.error('❌ Error fetching game status:', error.message);
        return null;
    }
}

async function checkAdminState() {
    console.log('🔧 Checking admin state...\n');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/state`);
        const data = await response.json();

        console.log('📊 Admin State:');
        console.log('  Game State:', data.gameState?.state);
        console.log('  Player Count:', data.gameState?.playerCount);
        console.log('  Bot Count:', data.gameState?.botCount);
        console.log('  Match Count:', data.gameState?.matchCount);
        console.log('');

        if (data.players && data.players.length > 0) {
            console.log('👥 Registered Players:');
            data.players.forEach((player, i) => {
                console.log(`  ${i + 1}. @${player.username} (FID: ${player.fid})`);
                console.log(`     Display: ${player.displayName}`);
            });
            console.log('');
        } else {
            console.log('⚠️  No players registered yet\n');
        }

        if (data.bots && data.bots.length > 0) {
            console.log('🤖 Bot Impersonations:');
            data.bots.forEach((bot, i) => {
                console.log(`  ${i + 1}. @${bot.username} (FID: ${bot.fid})`);
                console.log(`     Style: ${bot.style}`);
                console.log(`     Casts: ${bot.recentCasts?.length || 0}`);
            });
            console.log('');
        } else {
            console.log('⚠️  No bots created yet\n');
        }

        return data;
    } catch (error) {
        console.error('❌ Error fetching admin state:', error.message);
        return null;
    }
}

async function main() {
    console.log('🎮 Detective Game - State Checker\n');
    console.log(`Testing against: ${BASE_URL}\n`);
    console.log('='.repeat(50));
    console.log('');

    await checkGameState();
    await checkAdminState();

    console.log('='.repeat(50));
    console.log('✅ Check complete!\n');
}

main().catch(console.error);
