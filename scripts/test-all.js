#!/usr/bin/env node

/**
 * Master test script to run all production configuration tests
 * Tests Neon database, Redis Upstash, and AI integration
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTest(scriptName, description) {
    return new Promise((resolve) => {
        console.log(`\n🔄 Running ${description}...`);
        console.log('-'.repeat(50));

        const scriptPath = join(__dirname, scriptName);
        const child = spawn('node', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env
        });

        let output = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            const success = code === 0;
            console.log(output);
            
            if (success) {
                console.log(`✅ ${description} completed successfully!\n`);
            } else {
                console.log(`❌ ${description} failed with exit code ${code}\n`);
            }
            
            resolve({ success, scriptName, output });
        });
    });
}

async function main() {
    console.log('🎮 Detective Game - Production Configuration Test Suite');
    console.log('This will test your Neon database, Redis Upstash, and AI integration configurations.\n');
    console.log('='.repeat(80));
    
    // Check if required packages are installed
    try {
        await import('pg');
        console.log('✅ pg package is installed');
    } catch (e) {
        console.log('⚠️  pg package not installed - run: npm install pg');
        console.log('   Database tests may fail without this package.\n');
    }
    
    // Run all tests
    const tests = [
        { name: 'test-database.js', desc: 'Neon Database Configuration' },
        { name: 'test-redis.js', desc: 'Redis Upstash Configuration' },
        { name: 'test-ai.js', desc: 'AI Integration Configuration' }
    ];
    
    const results = [];
    
    for (const test of tests) {
        const result = await runTest(test.name, test.desc);
        results.push(result);
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(80));
    
    let passed = 0;
    for (const result of results) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`   ${status}: ${result.scriptName}`);
        if (result.success) passed++;
    }
    
    console.log('');
    console.log(`📊 Results: ${passed}/${tests.length} tests passed`);
    
    if (passed === tests.length) {
        console.log('🎉 All production configurations are working correctly!');
        console.log('\nYour Detective game is ready for production!');
    } else {
        console.log('⚠️  Some configurations need attention before production deployment.');
        console.log('\nPlease check the error messages above and fix any failing tests.');
    }
    
    // Provide next steps based on results
    console.log('\n💡 Next Steps:');
    if (!results.find(r => r.scriptName === 'test-database.js' && !r.success)) {
        console.log('   • Database: Ensure USE_DATABASE=true and DATABASE_URL is set in production');
    } else {
        console.log('   • Database: Set DATABASE_URL and USE_DATABASE=true in your environment');
        console.log('   • Run: npm install pg (if not already installed)');
        console.log('   • Run: npm run db:setup (after setting DATABASE_URL)');
    }
    
    if (!results.find(r => r.scriptName === 'test-redis.js' && !r.success)) {
        console.log('   • Redis: Ensure USE_REDIS=true and Upstash credentials are set');
    } else {
        console.log('   • Redis: Set UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, and USE_REDIS=true');
        console.log('   • Get Upstash Redis at: https://upstash.com');
    }
    
    if (!results.find(r => r.scriptName === 'test-ai.js' && !r.success)) {
        console.log('   • AI: Venice API is properly configured');
    } else {
        console.log('   • AI: Set VENICE_API_KEY in your environment');
        console.log('   • Get API key at: https://venice.ai/settings/api');
    }
    
    console.log('\n🚀 For production deployment:');
    console.log('   • Ensure all environment variables are set in your hosting environment');
    console.log('   • Consider using encrypted environment variable storage');
    console.log('   • Test in a staging environment before production');
}

main().catch(console.error);