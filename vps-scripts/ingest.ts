/**
 * VPS Ingest Script
 * Fetches ranking data from Rakuten API and saves to Supabase
 * Run with: npm run ingest
 */
import { getPool, getSettings, createSnapshot, closePool, SnapshotItemInput, getUsersWithAffiliateId, upsertUserAffiliateRate } from './db';

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
    mediumImageUrls: string[];
}

interface RakutenRankingResponse {
    Items: { Item: RakutenRankingItem }[];
    title: string;
    lastBuildDate: string;
}

async function fetchRanking(appId: string, genreId: string, page: number, affiliateId?: string): Promise<RakutenRankingResponse> {
    const params = new URLSearchParams({
        applicationId: appId,
        formatVersion: "2",
        genreId: genreId,
        page: String(page),
        period: "realtime",
    });

    if (affiliateId) {
        params.append("affiliateId", affiliateId);
    }

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

async function fetchAllRankings(appId: string, genreId: string, maxPages: number = 4, affiliateId?: string): Promise<RakutenRankingResponse> {
    const allItems: any[] = [];
    let title = '';
    let lastBuildDate = '';

    for (let page = 1; page <= maxPages; page++) {
        try {
            console.log(`  Fetching page ${page}...`);
            const response = await fetchRanking(appId, genreId, page, affiliateId);

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

async function cleanupOldSnapshots(categoryId: string, keepCount: number = 2) {
    const pool = getPool();

    // Get old snapshots
    const result = await pool.query(
        `SELECT id FROM "RankingSnapshot" WHERE "categoryId" = $1 ORDER BY "capturedAt" DESC OFFSET $2`,
        [categoryId, keepCount]
    );

    if (result.rows.length > 0) {
        console.log(`  Cleaning up ${result.rows.length} old snapshots...`);

        for (const row of result.rows) {
            // Delete items first (foreign key constraint)
            await pool.query('DELETE FROM "SnapshotItem" WHERE "snapshotId" = $1', [row.id]);
            // Then delete snapshot
            await pool.query('DELETE FROM "RankingSnapshot" WHERE id = $1', [row.id]);
        }
    }
}

async function ingestCategory(appId: string, categoryId: string, topN: number) {
    console.log(`\nProcessing category: ${categoryId}`);

    const response = await fetchAllRankings(appId, categoryId);
    console.log(`  Fetched ${response.Items.length} items`);

    // Limit to topN
    const itemsToSave = response.Items.slice(0, topN);

    // Debug: check item structure
    if (itemsToSave.length > 0) {
        const firstItem = itemsToSave[0];
        const rankItem = firstItem.Item || firstItem;
        console.log(`  First item keys:`, Object.keys(rankItem));
        console.log(`  mediumImageUrls:`, rankItem.mediumImageUrls);
        console.log(`  itemPrice:`, rankItem.itemPrice);
    }

    // Prepare items for snapshot
    const snapshotItems: SnapshotItemInput[] = itemsToSave.map((item, index) => {
        // Handle both { Item: {...} } and direct item structure
        const rankItem = item.Item || item;
        // Extract first image URL (mediumImageUrls is string[] with formatVersion=2)
        const imageUrl = rankItem.mediumImageUrls?.[0] || null;
        // Parse price (remove commas if present)
        const price = rankItem.itemPrice ? parseInt(rankItem.itemPrice.replace(/,/g, ''), 10) : null;

        return {
            rank: rankItem.rank || index + 1,
            itemKey: `${rankItem.shopCode}:${rankItem.itemCode}`,
            title: rankItem.itemName,
            itemUrl: rankItem.itemUrl,
            shopName: rankItem.shopName,
            price: price,
            imageUrl: imageUrl,
            apiRate: parseFloat(rankItem.affiliateRate) || null,
            rawJson: null,
        };
    });

    // Create snapshot with items
    const snapshotId = await createSnapshot(
        {
            categoryId,
            rankingType: 'realtime',
            fetchedCount: snapshotItems.length,
            status: 'SUCCESS',
        },
        snapshotItems
    );

    console.log(`  Saved ${snapshotItems.length} items to snapshot ${snapshotId}`);

    // Cleanup old snapshots (keep latest 2)
    await cleanupOldSnapshots(categoryId, 2);
}

async function ingestUserAffiliateRates(defaultAppId: string, categories: string[], topN: number) {
    const users = await getUsersWithAffiliateId();

    if (users.length === 0) {
        console.log('\nNo users with individual Rakuten credentials, skipping per-user rate fetch.');
        return;
    }

    console.log(`\n=== Fetching per-user rates for ${users.length} user(s) ===`);

    for (const user of users) {
        const appId = user.rakutenAppId || defaultAppId;

        for (const catId of categories) {
            try {
                console.log(`  User ${user.id}: category ${catId}...`);
                const response = await fetchAllRankings(appId, catId, 4, user.rakutenAffiliateId);
                const items = topN > 0 ? response.Items.slice(0, topN) : response.Items;

                let count = 0;
                for (const itemWrapper of items) {
                    const item = (itemWrapper as any).Item || itemWrapper;
                    const itemKey = item.itemCode as string;
                    const rate = parseFloat(item.affiliateRate) || 0;
                    await upsertUserAffiliateRate(user.id, itemKey, rate);
                    count++;
                }

                console.log(`  User ${user.id}: category ${catId} - ${count} rates saved`);

                // Rate limiting between categories
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e: any) {
                console.error(`  User ${user.id}: category ${catId} error:`, e.message);
            }
        }
    }
}

async function main() {
    console.log('=== Rakuten Ranking Ingest ===');
    console.log('Time:', new Date().toISOString());

    try {
        // Test connection
        const pool = getPool();
        const testResult = await pool.query('SELECT NOW() as time');
        console.log('Database connected:', testResult.rows[0].time);

        // Get settings
        const settings = await getSettings();

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
                await ingestCategory(appId, categoryId, settings.topN || 100);
                // Rate limiting between categories
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error processing category ${categoryId}:`, error);
            }
        }

        // Fetch per-user affiliate rates
        await ingestUserAffiliateRates(appId, categoryIds, settings.topN || 100);

        console.log('\n=== Ingest Complete ===');

    } finally {
        await closePool();
    }
}

main().catch(console.error);
