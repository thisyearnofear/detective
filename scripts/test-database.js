#!/usr/bin/env node

/**
 * Test script to check Neon database connectivity and configuration
 */

const DATABASE_URL = process.env.DATABASE_URL;
const USE_DATABASE = process.env.USE_DATABASE === "true";

async function testDatabaseConnection() {
    console.log('🔍 Testing Neon/PostgreSQL Database...\n');

    if (!DATABASE_URL) {
        console.log('⚠️  DATABASE_URL not set in environment');
        console.log('   Set DATABASE_URL in your .env file\n');
        return false;
    }

    if (!USE_DATABASE) {
        console.log('⚠️  USE_DATABASE is not set to "true" in environment');
        console.log('   Set USE_DATABASE=true in your .env file to enable database\n');
        return false;
    }

    console.log('✅ DATABASE_URL found:', DATABASE_URL.substring(0, 20) + '...');
    console.log('✅ USE_DATABASE enabled:', USE_DATABASE);
    console.log('');

    try {
        // Try to import pg module
        let pg;
        try {
            pg = await import("pg");
        } catch (err) {
            console.error('❌ pg package not installed');
            console.log('\nInstall with: npm install pg');
            return false;
        }

        const { Pool } = pg;
        const pool = new Pool({ 
            connectionString: DATABASE_URL,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        console.log('📡 Step 1: Testing database connection...');
        const result = await pool.query('SELECT NOW()');
        console.log('   ✅ Connection successful!');
        console.log('   Timestamp:', result.rows[0].now);
        console.log('');

        console.log('📡 Step 2: Testing table creation...');
        // Create a test table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS test_database_connection (
                id SERIAL PRIMARY KEY,
                test_value VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   ✅ Test table created successfully');

        // Insert a test record
        const testValue = `Connection test at ${new Date().toISOString()}`;
        await pool.query(
            'INSERT INTO test_database_connection (test_value) VALUES ($1)',
            [testValue]
        );
        console.log('   ✅ Test record inserted');

        // Query the test record
        const queryResult = await pool.query(
            'SELECT * FROM test_database_connection ORDER BY created_at DESC LIMIT 1'
        );
        console.log('   ✅ Test record retrieved');
        console.log('   Retrieved value:', queryResult.rows[0].test_value);
        console.log('');

        console.log('📡 Step 3: Testing existing application tables...');
        // Check if our application tables exist
        const tablesCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('game_cycles', 'matches', 'player_stats', 'game_results')
        `);

        const existingTables = tablesCheck.rows.map(row => row.table_name);
        console.log('   ✅ Found application tables:', existingTables.join(', '));

        if (existingTables.length === 0) {
            console.log('   ⚠️  Application tables not found - run: npm run db:setup');
        } else {
            console.log('   ✅ All required tables are present');
        }
        console.log('');

        // Clean up test data
        await pool.query('DELETE FROM test_database_connection WHERE test_value = $1', [testValue]);
        console.log('   ✅ Test data cleaned up');

        // Close the pool
        await pool.end();

        console.log('✅ Database test completed successfully!');
        console.log('');
        return true;

    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        if (error.code) {
            console.error('   Error code:', error.code);
        }
        return false;
    }
}

async function main() {
    console.log('🎮 Detective Game - Database Configuration Test\n');
    console.log('='.repeat(60));
    console.log('');

    const success = await testDatabaseConnection();

    console.log('='.repeat(60));
    if (success) {
        console.log('✅ Database configuration is working correctly!\n');
    } else {
        console.log('❌ Database configuration needs to be fixed.\n');
    }
}

main().catch(console.error);