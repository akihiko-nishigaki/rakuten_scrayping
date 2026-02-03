// Import from parent project's node_modules
import { PrismaClient } from '../node_modules/@prisma/client';
import { PrismaPg } from '../node_modules/@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from vps-scripts directory
dotenv.config({ path: path.join(__dirname, '.env') });

let prismaInstance: PrismaClient | null = null;
let poolInstance: Pool | null = null;

export function getPrisma(): PrismaClient {
    if (prismaInstance) return prismaInstance;

    const connectionString = process.env.DATABASE_URL;
    console.log('DATABASE_URL loaded:', connectionString ? connectionString.substring(0, 50) + '...' : 'NOT SET');
    console.log('Full DATABASE_URL:', connectionString);

    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    // Parse URL to verify host
    try {
        const url = new URL(connectionString);
        console.log('Connecting to host:', url.hostname, 'port:', url.port);
    } catch (e) {
        console.log('URL parse error:', e);
    }

    poolInstance = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    console.log('Pool created with connectionString');

    const adapter = new PrismaPg(poolInstance);
    prismaInstance = new PrismaClient({ adapter });

    console.log('PrismaClient created with adapter');

    return prismaInstance;
}

export async function closePrisma(): Promise<void> {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
    if (poolInstance) {
        await poolInstance.end();
        poolInstance = null;
    }
}
