// Direct PostgreSQL connection for VPS scripts (no Prisma)
import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from vps-scripts directory
dotenv.config({ path: path.join(__dirname, '.env') });

let poolInstance: Pool | null = null;

export function getPool(): Pool {
    if (poolInstance) return poolInstance;

    const connectionString = process.env.DATABASE_URL;
    console.log('DATABASE_URL:', connectionString ? connectionString.substring(0, 50) + '...' : 'NOT SET');

    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    poolInstance = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    return poolInstance;
}

export async function closePool(): Promise<void> {
    if (poolInstance) {
        await poolInstance.end();
        poolInstance = null;
    }
}

// Helper functions for common queries

export interface Settings {
    id: string;
    rakutenAppId: string | null;
    categories: string[];
    rankingTypes: string[];
    topN: number;
    ingestEnabled: boolean;
    categoryOrder: string[];
}

export async function getSettings(): Promise<Settings | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM "Settings" LIMIT 1');
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id,
        rakutenAppId: row.rakutenAppId,
        categories: row.categories || [],
        rankingTypes: row.rankingTypes || [],
        topN: row.topN || 0,
        ingestEnabled: row.ingestEnabled ?? true,
        categoryOrder: row.categoryOrder || [],
    };
}

export interface SnapshotInput {
    categoryId: string;
    rankingType: string;
    fetchedCount: number;
    status: string;
    errorMessage?: string;
}

export interface SnapshotItemInput {
    rank: number;
    itemKey: string;
    title: string;
    itemUrl: string;
    shopName: string;
    price: number | null;
    imageUrl: string | null;
    apiRate: number | null;
    rawJson: object | null;
}

export async function createSnapshot(
    input: SnapshotInput,
    items: SnapshotItemInput[]
): Promise<string> {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Generate cuid-like ID
        const snapshotId = generateId();

        // Insert snapshot
        await client.query(
            `INSERT INTO "RankingSnapshot" (id, "capturedAt", "categoryId", "rankingType", "fetchedCount", status, "errorMessage")
             VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
            [snapshotId, input.categoryId, input.rankingType, input.fetchedCount, input.status, input.errorMessage || null]
        );

        // Insert items
        for (const item of items) {
            const itemId = generateId();
            await client.query(
                `INSERT INTO "SnapshotItem" (id, "snapshotId", rank, "itemKey", title, "itemUrl", "shopName", price, "imageUrl", "apiRate", "rawJson")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [itemId, snapshotId, item.rank, item.itemKey, item.title, item.itemUrl, item.shopName, item.price, item.imageUrl, item.apiRate, item.rawJson ? JSON.stringify(item.rawJson) : null]
            );
        }

        await client.query('COMMIT');
        return snapshotId;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function getVerifiedRates(itemKeys: string[]): Promise<Map<string, number>> {
    if (itemKeys.length === 0) return new Map();

    const pool = getPool();
    const placeholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
        `SELECT "itemKey", "verifiedRate" FROM "VerifiedRateCurrent" WHERE "itemKey" IN (${placeholders})`,
        itemKeys
    );

    const map = new Map<string, number>();
    for (const row of result.rows) {
        map.set(row.itemKey, row.verifiedRate);
    }
    return map;
}

// Simple ID generator (cuid-like)
function generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
}
