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

    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    poolInstance = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    const adapter = new PrismaPg(poolInstance);
    prismaInstance = new PrismaClient({ adapter });

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
