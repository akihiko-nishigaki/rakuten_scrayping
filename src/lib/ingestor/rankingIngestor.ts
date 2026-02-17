import { prisma } from '@/lib/prisma';
import { RakutenClient } from '@/lib/rakuten/client';
import { DEFAULT_CATEGORY_ID } from '@/lib/rakuten/categories';
import { VerificationService } from '@/lib/verification/service';

export class RankingIngestor {
    private client: RakutenClient;

    constructor(appId: string, affiliateId?: string, accessKey?: string) {
        this.client = new RakutenClient(appId, affiliateId, accessKey);
    }

    async ingestAllConfiguredCategories() {
        // 1. Get Settings (or default)
        const settings = await prisma.settings.findFirst();
        const categories = settings?.categories.length ? settings.categories : [DEFAULT_CATEGORY_ID]; // Default: 総合ランキング
        const topN = settings?.topN ?? 0; // 0 = fetch all available (up to 120 items)

        console.log(`Starting ingest for ${categories.length} categories. TopN: ${topN}`);

        const results = [];
        const snapshotIds: string[] = [];

        for (const catId of categories) {
            try {
                const res = await this.ingestCategory(catId, topN);
                results.push({ categoryId: catId, status: "SUCCESS", count: res.count });
                snapshotIds.push(res.snapshotId);
            } catch (e: any) {
                console.error(`Error ingesting category ${catId}:`, e);
                results.push({ categoryId: catId, status: "ERROR", error: e.message });
            }
        }

        // 2. Collect itemKeys from snapshots for anchoring
        const snapshotItemKeys = new Set<string>();
        if (snapshotIds.length > 0) {
            const snapshotItems = await prisma.snapshotItem.findMany({
                where: { snapshotId: { in: snapshotIds } },
                select: { itemKey: true },
            });
            for (const item of snapshotItems) {
                snapshotItemKeys.add(item.itemKey);
            }
        }
        console.log(`Snapshot anchoring: ${snapshotItemKeys.size} unique itemKeys across ${snapshotIds.length} snapshots`);

        // 3. Fetch per-user affiliate rates (parallel by appId group, anchored to snapshot)
        await this.ingestUserAffiliateRates(categories, topN, snapshotItemKeys);

        return results;
    }

    /**
     * For each user with their own Rakuten credentials,
     * fetch ranking data and store per-user affiliate rates.
     * Users are grouped by appId and groups run in parallel.
     * Only rates for items in the current snapshot are saved.
     */
    private async ingestUserAffiliateRates(categories: string[], topN: number, snapshotItemKeys: Set<string>) {
        const usersWithCredentials = await prisma.user.findMany({
            where: {
                rakutenAffiliateId: { not: null },
            },
            select: {
                id: true,
                rakutenAppId: true,
                rakutenAccessKey: true,
                rakutenAffiliateId: true,
            },
        });

        if (usersWithCredentials.length === 0) {
            console.log('No users with individual Rakuten credentials, skipping per-user rate fetch.');
            return;
        }

        console.log(`Fetching per-user rates for ${usersWithCredentials.length} user(s)...`);

        // Group users by effective appId (rate limits are per applicationId)
        const systemAppId = process.env.RAKUTEN_APP_ID || '';
        const appIdGroups = new Map<string, typeof usersWithCredentials>();

        for (const user of usersWithCredentials) {
            const effectiveAppId = user.rakutenAppId || systemAppId;
            if (!effectiveAppId || !user.rakutenAffiliateId) continue;

            const group = appIdGroups.get(effectiveAppId) || [];
            group.push(user);
            appIdGroups.set(effectiveAppId, group);
        }

        console.log(`Grouped into ${appIdGroups.size} appId group(s) for parallel processing`);

        // Process groups concurrently; within each group, process users sequentially
        const groupPromises = Array.from(appIdGroups.entries()).map(
            async ([, users]) => {
                for (const user of users) {
                    await this.fetchRatesForUser(user, categories, topN, snapshotItemKeys);
                }
            }
        );

        await Promise.allSettled(groupPromises);
    }

    private async fetchRatesForUser(
        user: { id: string; rakutenAppId: string | null; rakutenAccessKey: string | null; rakutenAffiliateId: string | null },
        categories: string[],
        topN: number,
        snapshotItemKeys: Set<string>,
    ) {
        const userAppId = user.rakutenAppId || process.env.RAKUTEN_APP_ID;
        if (!userAppId || !user.rakutenAffiliateId) return;

        const userClient = new RakutenClient(userAppId, user.rakutenAffiliateId, user.rakutenAccessKey || undefined);

        for (const catId of categories) {
            try {
                const rankingData = await userClient.getAllRankings(catId, 4);
                const apiItems = topN > 0 ? rankingData.Items.slice(0, topN) : rankingData.Items;

                const upsertData = apiItems
                    .map((itemWrapper) => {
                        const item = (itemWrapper as any).Item || itemWrapper;
                        const itemKey = item.itemCode as string;
                        const rate = parseFloat(item.affiliateRate) || 0;
                        return { itemKey, rate };
                    })
                    .filter(({ itemKey }) => snapshotItemKeys.size === 0 || snapshotItemKeys.has(itemKey));

                for (const { itemKey, rate } of upsertData) {
                    await prisma.userAffiliateRate.upsert({
                        where: {
                            userId_itemKey: { userId: user.id, itemKey },
                        },
                        create: {
                            userId: user.id,
                            itemKey,
                            affiliateRate: rate,
                        },
                        update: {
                            affiliateRate: rate,
                            fetchedAt: new Date(),
                        },
                    });
                }

                console.log(`  User ${user.id}: category ${catId} - ${upsertData.length} rates saved (${apiItems.length - upsertData.length} filtered)`);
            } catch (e: any) {
                console.error(`  User ${user.id}: category ${catId} error:`, e.message);
            }
        }
    }

    async ingestCategory(categoryId: string, topN: number) {
        // 2. Fetch API - get all available pages
        const rankingData = await this.client.getAllRankings(categoryId, 4); // Max 4 pages = 120 items
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

        // 4. Process Items
        for (let i = 0; i < apiItems.length; i++) {
            const itemWrapper = apiItems[i];
            const item = itemWrapper.Item || itemWrapper; // Handle both formats
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
                } else if (item.itemUrl?.includes('item.rakuten.co.jp')) {
                    // itemUrl is already a direct URL (no affiliate wrapper)
                    directItemUrl = item.itemUrl;
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
            const imageUrl = item.mediumImageUrls?.[0]?.imageUrl || null;
            const price = item.itemPrice ? parseInt(String(item.itemPrice).replace(/,/g, ''), 10) : null;

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
                    price: price,
                    imageUrl: imageUrl,
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

        // 5. Cleanup old snapshots (keep only latest 2 per category)
        await this.cleanupOldSnapshots(categoryId, 2);

        return { count, snapshotId: snapshot.id };
    }

    /**
     * Delete old snapshots, keeping only the latest N per category
     */
    private async cleanupOldSnapshots(categoryId: string, keepCount: number) {
        // Get all snapshots for this category, ordered by date
        const snapshots = await prisma.rankingSnapshot.findMany({
            where: { categoryId },
            orderBy: { capturedAt: 'desc' },
            select: { id: true, capturedAt: true },
        });

        // Keep only the latest N, delete the rest
        const snapshotsToDelete = snapshots.slice(keepCount);

        if (snapshotsToDelete.length === 0) {
            return;
        }

        const idsToDelete = snapshotsToDelete.map(s => s.id);

        console.log(`Cleaning up ${idsToDelete.length} old snapshots for category ${categoryId}`);

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
