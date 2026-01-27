import { prisma } from '@/lib/prisma';
import { RakutenClient } from '@/lib/rakuten/client';
import { VerificationService } from '@/lib/verification/service';

export class RankingIngestor {
    private client: RakutenClient;

    constructor(appId: string, affiliateId?: string) {
        this.client = new RakutenClient(appId, affiliateId);
    }

    async ingestAllConfiguredCategories() {
        // 1. Get Settings (or default)
        const settings = await prisma.settings.findFirst();
        const categories = settings?.categories.length ? settings.categories : ["100227", "200162"]; // Default: Food, Books (example IDs)
        const topN = settings?.topN || 30;

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
        // 2. Fetch API
        const rankingData = await this.client.getRanking(categoryId);
        const apiItems = rankingData.Items.slice(0, topN);

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
        for (const itemWrapper of apiItems) {
            const item = itemWrapper.Item;
            const rank = item.rank;
            const itemKey = item.itemCode; // Use itemCode as unique key

            const apiRate = parseFloat(item.affiliateRate) || null;

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
                    itemUrl: item.itemUrl,
                    shopName: item.shopName,
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

        return { count, snapshotId: snapshot.id };
    }
}
