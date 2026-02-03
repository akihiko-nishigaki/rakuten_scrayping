import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
    console.log('=== Database Connection Test ===');

    const connectionString = process.env.DATABASE_URL;
    console.log('DATABASE_URL:', connectionString);

    if (!connectionString) {
        console.error('DATABASE_URL is not set');
        return;
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('\nTesting direct Pool connection...');
        const result = await pool.query('SELECT NOW() as time, current_database() as db');
        console.log('SUCCESS! Connected to:', result.rows[0]);

        // Test settings table
        console.log('\nTesting Settings table...');
        const settings = await pool.query('SELECT * FROM "Settings" LIMIT 1');
        console.log('Settings found:', settings.rows.length > 0 ? 'Yes' : 'No');
        if (settings.rows[0]) {
            console.log('Settings:', JSON.stringify(settings.rows[0], null, 2));
        }
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await pool.end();
    }
}

testConnection();
