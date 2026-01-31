/**
 * VPS Ingest Script
 * Fetches ranking data from Rakuten API and saves to Supabase
 * Run with: npm run ingest
 */
import 'dotenv/config';
import { getPrisma, closePrisma } from './db';

const RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";

interface RakutenRankingItem {
    rank: number;
    itemName: string;
    itemCode: string;
    itemPrice: string;
    itemUrl: string;
    affiliateUrl: string;
    affiliateRate: string;
    shopName: string;
    shopCode: string;
    reviewCount: number;
    reviewAverage: string;
    mediumImageUrls: { imageUrl: string }[];
}

interface RakutenRankingResponse {
    Items: { Item: RakutenRankingItem }[];
    title: string;
    lastBuildDate: string;
}

async function fetchRanking(appId: string, genreId: string, page: number): Promise<RakutenRankingResponse> {
    const params = new URLSearchParams({
        applicationId: appId,
        formatVersion: "2",
        genreId: genreId,
        page: String(page),
    });

    const res = await fetch(`${RAKUTEN_API_ENDPOINT}?${params.toString()}`);

    if (!res.ok) {
        throw new Error(`Rakuten API Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    if (data.error) {
        throw new Error(`Rakuten API Error: ${data.error} - ${data.error_description}`);
    }

    return data as RakutenRankingResponse;
}

async function fetchAllRankings(appId: string, genreId: string, maxPages: number = 4): Promise<RakutenRankingResponse> {
    const allItems: any[] = [];
    let title = '';
    let lastBuildDate = '';

    for (let page = 1; page <= maxPages; page++) {
        try {
            console.log(`  Fetching page ${page}...`);
            const response = await fetchRanking(appId, genreId, page);

            if (page === 1) {
                title = response.title;
                lastBuildDate = response.lastBuildDate;
            }

            if (!response.Items || response.Items.length === 0) {
                break;
            }

            allItems.push(...response.Items);

            // Rate limiting
            if (page < maxPages) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.log(`  Stopped at page ${page}: ${error}`);
            break;
        }
    }

    return { Items: allItems, title, lastBuildDate };
}

async function cleanupOldSnapshots(prisma: any, categoryId: string, keepCount: number = 2) {
    const snapshots = await prisma.rankingSnapshot.findMany({
        where: { categoryId },
        orderBy: { capturedAt: 'desc' },
        select: { id: true, capturedAt: true },
    });

    const snapshotsToDelete = snapshots.slice(keepCount);

    if (snapshotsToDelete.length > 0) {
        console.log(`  Cleaning up ${snapshotsToDelete.length} old snapshots...`);

        for (const snapshot of snapshotsToDelete) {
            await prisma.snapshotItem.deleteMany({
                where: { snapshotId: snapshot.id },
            });
            await prisma.rankingSnapshot.delete({
                where: { id: snapshot.id },
            });
        }
    }
}

async function ingestCategory(prisma: any, appId: string, categoryId: string, topN: number) {
    console.log(`\nProcessing category: ${categoryId}`);

    const response = await fetchAllRankings(appId, categoryId);
    console.log(`  Fetched ${response.Items.length} items`);

    // Limit to topN
    const itemsToSave = response.Items.slice(0, topN);

    // Create snapshot
    const snapshot = await prisma.rankingSnapshot.create({
        data: {
            categoryId: categoryId,
            capturedAt: new Date(),
        },
    });

    // Save items
    for (let i = 0; i < itemsToSave.length; i++) {
        const item = itemsToSave[i].Item;
        const itemKey = `${item.shopCode}:${item.itemCode}`;

        await prisma.snapshotItem.create({
            data: {
                snapshotId: snapshot.id,
                rank: item.rank || i + 1,
                itemKey,
                title: item.itemName,
                itemUrl: item.itemUrl,
                shopName: item.shopName,
                apiRate: parseFloat(item.affiliateRate) || 0,
            },
        });
    }

    console.log(`  Saved ${itemsToSave.length} items to snapshot ${snapshot.id}`);

    // Cleanup old snapshots (keep latest 2)
    await cleanupOldSnapshots(prisma, categoryId, 2);
}

async function main() {
    console.log('=== Rakuten Ranking Ingest ===');
    console.log('Time:', new Date().toISOString());

    const prisma = getPrisma();

    try {
        // Get settings
        const settings = await prisma.settings.findFirst();

        if (!settings) {
            console.error('No settings found. Please configure settings first.');
            return;
        }

        const appId = settings.rakutenAppId || process.env.RAKUTEN_APP_ID;
        if (!appId) {
            console.error('RAKUTEN_APP_ID is not set');
            return;
        }

        if (!settings.ingestEnabled) {
            console.log('Ingest is disabled in settings');
            return;
        }

        // Get categories from settings
        const categoryIds = settings.categories || [];

        if (categoryIds.length === 0) {
            console.log('No categories configured in settings');
            return;
        }

        console.log(`Found ${categoryIds.length} categories`);
        console.log(`TopN: ${settings.topN}`);

        // Process each category
        for (const categoryId of categoryIds) {
            try {
                await ingestCategory(prisma, appId, categoryId, settings.topN || 100);
                // Rate limiting between categories
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error processing category ${categoryId}:`, error);
            }
        }

        console.log('\n=== Ingest Complete ===');

    } finally {
        await closePrisma();
    }
}

main().catch(console.error);
