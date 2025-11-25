#!/usr/bin/env node

/**
 * Test script to check Redis Upstash connectivity and configuration
 */

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = process.env.USE_REDIS === "true";

class UpstashRedisClient {
    constructor(url, token) {
        this.url = url;
        this.token = token;
    }

    async command(...args) {
        const response = await fetch(this.url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(args),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upstash error: ${error}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`Upstash error: ${data.error}`);
        }
        return data.result;
    }

    async ping() {
        return this.command("PING");
    }

    async set(key, value, options) {
        const args = ["SET", key, value];
        if (options?.ex) {
            args.push("EX", options.ex);
        }
        if (options?.nx) {
            args.push("NX");
        }
        return this.command(...args);
    }

    async get(key) {
        return this.command("GET", key);
    }

    async del(...keys) {
        if (keys.length === 0) return 0;
        return this.command("DEL", ...keys);
    }

    async hset(key, field, value) {
        return this.command("HSET", key, field, value);
    }

    async hget(key, field) {
        return this.command("HGET", key, field);
    }

    async sadd(key, ...members) {
        if (members.length === 0) return 0;
        return this.command("SADD", key, ...members);
    }

    async smembers(key) {
        return this.command("SMEMBERS", key);
    }

    async keys(pattern) {
        return this.command("KEYS", pattern);
    }

    async ttl(key) {
        return this.command("TTL", key);
    }
}

async function testRedisConnection() {
    console.log('🔍 Testing Redis Upstash...\n');

    if (!UPSTASH_REDIS_REST_URL) {
        console.log('⚠️  UPSTASH_REDIS_REST_URL not set in environment');
        console.log('   Get your Redis instance at: https://upstash.com\n');
        return false;
    }

    if (!UPSTASH_REDIS_REST_TOKEN) {
        console.log('⚠️  UPSTASH_REDIS_REST_TOKEN not set in environment');
        console.log('   Get your token from your Upstash dashboard\n');
        return false;
    }

    if (!USE_REDIS) {
        console.log('⚠️  USE_REDIS is not set to "true" in environment');
        console.log('   Set USE_REDIS=true in your .env file to enable Redis\n');
        return false;
    }

    console.log('✅ UPSTASH_REDIS_REST_URL found:', UPSTASH_REDIS_REST_URL.substring(0, 30) + '...');
    console.log('✅ UPSTASH_REDIS_REST_TOKEN found:', UPSTASH_REDIS_REST_TOKEN.substring(0, 8) + '...');
    console.log('✅ USE_REDIS enabled:', USE_REDIS);
    console.log('');

    try {
        const client = new UpstashRedisClient(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);

        console.log('📡 Step 1: Testing Redis PING...');
        const pingResult = await client.ping();
        console.log('   ✅ PING successful! Response:', pingResult);
        console.log('');

        console.log('📡 Step 2: Testing basic SET/GET operations...');
        const testKey = `test:${Date.now()}`;
        const testValue = `Test value created at ${new Date().toISOString()}`;
        
        await client.set(testKey, testValue);
        console.log('   ✅ SET operation successful');
        
        const retrievedValue = await client.get(testKey);
        console.log('   ✅ GET operation successful');
        console.log('   Retrieved value:', retrievedValue);
        console.log('');

        console.log('📡 Step 3: Testing advanced operations...');
        // Test hash operations
        const hashKey = `${testKey}:hash`;
        await client.hset(hashKey, 'field1', 'value1');
        await client.hset(hashKey, 'field2', 'value2');
        const hashValue1 = await client.hget(hashKey, 'field1');
        console.log('   ✅ HSET/HGET operations successful - field1:', hashValue1);
        
        // Test set operations
        const setKey = `${testKey}:set`;
        await client.sadd(setKey, 'member1', 'member2', 'member3');
        const setMembers = await client.smembers(setKey);
        console.log('   ✅ SADD/SMEMBERS operations successful - members:', setMembers.join(', '));
        console.log('');

        console.log('📡 Step 4: Testing expiration...');
        const expiringKey = `${testKey}:expiring`;
        await client.set(expiringKey, 'will expire', { ex: 5 }); // 5 seconds
        const ttl = await client.ttl(expiringKey);
        console.log('   ✅ SET with expiration successful - TTL:', ttl, 'seconds');
        console.log('');

        console.log('📡 Step 5: Testing keys pattern matching...');
        const keys = await client.keys(`${testKey}*`);
        console.log('   ✅ KEYS operation successful - found keys:', keys.length);
        keys.forEach(key => console.log('     -', key));
        console.log('');

        // Clean up test data
        await client.del(...keys);
        console.log('   ✅ Test data cleaned up');

        console.log('✅ Redis Upstash test completed successfully!');
        console.log('');
        return true;

    } catch (error) {
        console.error('❌ Redis test failed:', error.message);
        if (error.stack) {
            console.error('   Stack trace:', error.stack);
        }
        return false;
    }
}

async function main() {
    console.log('🎮 Detective Game - Redis Upstash Configuration Test\n');
    console.log('='.repeat(60));
    console.log('');

    const success = await testRedisConnection();

    console.log('='.repeat(60));
    if (success) {
        console.log('✅ Redis Upstash configuration is working correctly!\n');
    } else {
        console.log('❌ Redis Upstash configuration needs to be fixed.\n');
    }
}

main().catch(console.error);