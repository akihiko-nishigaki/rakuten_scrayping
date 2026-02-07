import { prisma } from '@/lib/prisma';
import { RakutenClient } from '@/lib/rakuten/client';
import { DEFAULT_CATEGORY_ID, getCategoryName } from '@/lib/rakuten/categories';
import { VerificationService } from '@/lib/verification/service';

export class RankingIngestor {
    private client: RakutenClient;

    constructor(appId: string, affiliateId?: string) {
        this.client = new RakutenClient(appId, affiliateId);
    }

    async ingestAllConfiguredCategories() {
        // 1. Get Settings (or default)
        const settings = await prisma.settings.findFirst();
        const categories = settings?.categories.length ? settings.categories : [DEFAULT_CATEGORY_ID]; // Default: 総合ランキング
        const topN = settings?.topN ?? 0; // 0 = fetch all available (up to 120 items)

        console.log(`Starting ingest for ${categories.length} categories. TopN: ${topN}`);

        const results = [];

        for (const catId of categories) {
            try {
                const res = await this.ingestCategory(catId, topN);
                results.push({ categoryId: catId, status: "SUCCESS", count: res.count });
            } catch (e: any) {
                console.error(`Error ingesting category ${catId}:`, e);
                results.push({ categoryId: catId, status: "ERROR", error: e.message });
            }
        }

        return results;
    }

    async ingestCategory(categoryId: string, topN: number) {
        // 2. Fetch API - get all available pages
        const rankingData = await this.client.getAllRankings(categoryId, 4); // Max 4 pages = 120 items

        // Validate API response title matches the expected category
        const expectedName = getCategoryName(categoryId);
        if (rankingData.title) {
            const titleMatch = categoryId === '0'
                || rankingData.title.includes(expectedName)
                || rankingData.title.includes('総合');
            if (!titleMatch) {
                console.warn(
                    `[Ingestor] Category mismatch: requested categoryId=${categoryId} (${expectedName}), ` +
                    `but API returned title="${rankingData.title}". Skipping this category.`
                );
                // Save as ERROR snapshot to record the mismatch
                await prisma.rankingSnapshot.create({
                    data: {
                        categoryId,
                        rankingType: "realtime",
                        fetchedCount: 0,
                        status: "ERROR",
                        errorMessage: `Category mismatch: API returned "${rankingData.title}" for categoryId=${categoryId}`,
                    }
                });
                return { count: 0, snapshotId: null };
            }
        }

        const apiItems = topN > 0 ? rankingData.Items.slice(0, topN) : rankingData.Items;

        // 3. Create Snapshot
        const snapshot = await prisma.rankingSnapshot.create({
            data: {
                categoryId,
                rankingType: "realtime", // Default for now
                fetchedCount: apiItems.length,
                status: "SUCCESS",
            }
        });

        let count = 0;

        // 4. Process Items (formatVersion: "2" returns items directly, not wrapped)
        for (let i = 0; i < apiItems.length; i++) {
            const item = apiItems[i];
            const rank = item.rank || (i + 1); // Use index if rank not provided
            const itemKey = item.itemCode; // Use itemCode as unique key (format: shopCode:itemId)

            // Extract direct item page URL from affiliate link's pc= parameter
            // itemUrl format: https://hb.afl.rakuten.co.jp/...?pc=https%3A%2F%2Fitem.rakuten.co.jp%2F...&...
            let directItemUrl = '';
            try {
                const affiliateUrl = new URL(item.itemUrl);
                const pcParam = affiliateUrl.searchParams.get('pc');
                if (pcParam) {
                    directItemUrl = decodeURIComponent(pcParam);
                }
            } catch (e) {
                // Fallback: if itemUrl is already a direct URL
                if (item.itemUrl?.includes('item.rakuten.co.jp')) {
                    directItemUrl = item.itemUrl;
                }
            }

            // Final fallback: build from shopCode (not ideal but better than nothing)
            if (!directItemUrl) {
                const [shopCode] = itemKey.split(':');
                directItemUrl = `https://item.rakuten.co.jp/${shopCode}/`;
            }

            const apiRate = parseFloat(item.affiliateRate) || null;

            // Extract price
            const price = typeof item.itemPrice === 'number'
                ? item.itemPrice
                : (typeof item.itemPrice === 'string' ? parseInt(item.itemPrice, 10) || null : null);

            // Extract image URL (formatVersion 2: arrays of URL strings)
            let imageUrl: string | null = null;
            if (item.mediumImageUrls && item.mediumImageUrls.length > 0) {
                const img = item.mediumImageUrls[0];
                imageUrl = typeof img === 'string' ? img : (img as any)?.imageUrl ?? null;
            } else if (item.smallImageUrls && item.smallImageUrls.length > 0) {
                const img = item.smallImageUrls[0];
                imageUrl = typeof img === 'string' ? img : (img as any)?.imageUrl ?? null;
            }

            // Check existing verified rate
            const verified = await prisma.verifiedRateCurrent.findUnique({
                where: { itemKey }
            });

            // Save Snapshot Item
            const snapshotItem = await prisma.snapshotItem.create({
                data: {
                    snapshotId: snapshot.id,
                    rank,
                    itemKey,
                    title: item.itemName,
                    itemUrl: directItemUrl, // Use direct item page URL
                    shopName: item.shopName,
                    price,
                    imageUrl,
                    apiRate: apiRate,
                    rawJson: item as any,
                }
            });

            // Upsert Verification Task
            await VerificationService.upsertTaskFromIngest(
                itemKey,
                snapshotItem.id,
                rank,
                apiRate,
                verified?.verifiedRate ?? null,
                verified?.updatedAt
            );

            count++;
        }

        // 5. Cleanup old snapshots (keep only latest 2 per category + rankingType)
        await this.cleanupOldSnapshots(categoryId, "realtime", 2);

        return { count, snapshotId: snapshot.id };
    }

    /**
     * Delete old snapshots, keeping only the latest N per category + rankingType
     */
    private async cleanupOldSnapshots(categoryId: string, rankingType: string, keepCount: number) {
        // Get all snapshots for this category + rankingType, ordered by date
        const snapshots = await prisma.rankingSnapshot.findMany({
            where: { categoryId, rankingType },
            orderBy: { capturedAt: 'desc' },
            select: { id: true, capturedAt: true },
        });

        // Keep only the latest N, delete the rest
        const snapshotsToDelete = snapshots.slice(keepCount);

        if (snapshotsToDelete.length === 0) {
            return;
        }

        const idsToDelete = snapshotsToDelete.map(s => s.id);

        console.log(`Cleaning up ${idsToDelete.length} old snapshots for category ${categoryId} (${rankingType})`);

        // Delete snapshot items first (foreign key constraint)
        await prisma.snapshotItem.deleteMany({
            where: { snapshotId: { in: idsToDelete } }
        });

        // Delete snapshots
        await prisma.rankingSnapshot.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        console.log(`Deleted ${idsToDelete.length} old snapshots`);
    }
}
