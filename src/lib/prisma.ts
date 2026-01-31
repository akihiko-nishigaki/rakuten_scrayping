import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    // Configure SSL for production (Supabase requires SSL)
    const isProduction = process.env.NODE_ENV === 'production';
    const pool = new Pool({
        connectionString,
        ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({
        adapter,
        log: isProduction ? [] : ['query'],
    });
}

// Lazy initialization - only create client when accessed
export const prisma = new Proxy({} as PrismaClient, {
    get(target, prop) {
        if (!globalForPrisma.prisma) {
            globalForPrisma.prisma = createPrismaClient();
        }
        return Reflect.get(globalForPrisma.prisma, prop);
    },
});
