'use server';

import { prisma } from '@/lib/prisma';
import { SnapshotItem, VerifiedRateCurrent } from '@prisma/client';

export type RankingItemWithVerification = SnapshotItem & {
    verifiedRate: VerifiedRateCurrent | null;
    diff: number | null;
    rankChange: number | 'new' | null; // positive = up, negative = down, 'new' = new entry
};

/**
 * Get the list of snapshots for history navigation
 */
export async function getSnapshotListAction() {
    return await prisma.rankingSnapshot.findMany({
        orderBy: { capturedAt: 'desc' },
        take: 50, // Limit for UI
        include: {
            _count: {
                select: { items: true }
            }
        }
    });
}

/**
 * Get ranking items for a specific snapshot.
 * Joins with VerifiedRateCurrent to show comparison.
 */
export async function getRankingItemsAction(snapshotId: string) {
    const items = await prisma.snapshotItem.findMany({
        where: { snapshotId },
        orderBy: { rank: 'asc' },
    });

    // Fetch verified rates for these items
    const itemKeys = items.map(i => i.itemKey);
    const verifiedRates = await prisma.verifiedRateCurrent.findMany({
        where: { itemKey: { in: itemKeys } }
    });

    const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v]));

    return items.map(item => {
        const verified = verifiedMap.get(item.itemKey) || null;
        let diff: number | null = null;

        if (item.apiRate !== null && verified?.verifiedRate) {
            diff = verified.verifiedRate - item.apiRate;
        }

        return {
            ...item,
            verifiedRate: verified,
            diff,
        } as RankingItemWithVerification;
    });
}

/**
 * Get the LATEST snapshot's ranking items with rank changes from previous snapshot
 */
export async function getLatestRankingAction(categoryId?: string) {
    const where: any = { status: 'SUCCESS' };
    if (categoryId) where.categoryId = categoryId;

    // Get the latest snapshot first to determine its rankingType
    const latest = await prisma.rankingSnapshot.findFirst({
        where,
        orderBy: { capturedAt: 'desc' },
    });

    if (!latest) return null;

    // Get the previous snapshot with the SAME categoryId AND rankingType
    const previous = await prisma.rankingSnapshot.findFirst({
        where: {
            ...where,
            rankingType: latest.rankingType,
            capturedAt: { lt: latest.capturedAt },
        },
        orderBy: { capturedAt: 'desc' },
    }) || null;

    // Get items for latest snapshot
    const items = await prisma.snapshotItem.findMany({
        where: { snapshotId: latest.id },
        orderBy: { rank: 'asc' },
    });

    // Get previous snapshot items for comparison
    let previousRankMap = new Map<string, number>();
    if (previous) {
        const previousItems = await prisma.snapshotItem.findMany({
            where: { snapshotId: previous.id },
            select: { itemKey: true, rank: true },
        });
        previousRankMap = new Map(previousItems.map(i => [i.itemKey, i.rank]));
    }

    // Fetch verified rates
    const itemKeys = items.map(i => i.itemKey);
    const verifiedRates = await prisma.verifiedRateCurrent.findMany({
        where: { itemKey: { in: itemKeys } }
    });
    const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v]));

    const itemsWithChanges = items.map(item => {
        const verified = verifiedMap.get(item.itemKey) || null;
        let diff: number | null = null;
        let rankChange: number | 'new' | null = null;

        if (item.apiRate !== null && verified?.verifiedRate) {
            diff = verified.verifiedRate - item.apiRate;
        }

        // Calculate rank change
        if (previous) {
            const previousRank = previousRankMap.get(item.itemKey);
            if (previousRank === undefined) {
                rankChange = 'new';
            } else {
                // positive means moved up (e.g., from 5 to 3 = +2)
                rankChange = previousRank - item.rank;
            }
        }

        return {
            ...item,
            verifiedRate: verified,
            diff,
            rankChange,
        } as RankingItemWithVerification;
    });

    return { snapshot: latest, items: itemsWithChanges, previousSnapshot: previous };
}

/**
 * Get the latest snapshot for each category with top N items
 * Used for the dashboard overview
 * Groups by categoryId + rankingType to avoid mixing different ranking types
 */
export async function getCategorySnapshotsAction(topN: number = 3) {
    // Get all unique categoryId + rankingType pairs that have successful snapshots
    const categoryPairs = await prisma.rankingSnapshot.findMany({
        where: { status: 'SUCCESS' },
        select: { categoryId: true, rankingType: true },
        distinct: ['categoryId', 'rankingType'],
    });

    // Deduplicate by categoryId: keep only the pair with the most recent snapshot
    const latestPerCategory = new Map<string, { categoryId: string; rankingType: string }>();
    for (const pair of categoryPairs) {
        if (!latestPerCategory.has(pair.categoryId)) {
            latestPerCategory.set(pair.categoryId, pair);
        }
    }

    const results = await Promise.all(
        Array.from(latestPerCategory.values()).map(async ({ categoryId, rankingType }) => {
            // Get latest snapshot for this category + rankingType pair
            const snapshot = await prisma.rankingSnapshot.findFirst({
                where: { categoryId, rankingType, status: 'SUCCESS' },
                orderBy: { capturedAt: 'desc' },
            });

            if (!snapshot) return null;

            // Get top N items for this snapshot
            const items = await prisma.snapshotItem.findMany({
                where: { snapshotId: snapshot.id },
                orderBy: { rank: 'asc' },
                take: topN,
            });

            // Get verified rates for these items
            const itemKeys = items.map(i => i.itemKey);
            const verifiedRates = await prisma.verifiedRateCurrent.findMany({
                where: { itemKey: { in: itemKeys } }
            });
            const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v]));

            const itemsWithVerification = items.map(item => ({
                ...item,
                verifiedRate: verifiedMap.get(item.itemKey) || null,
            }));

            return {
                categoryId,
                snapshot,
                items: itemsWithVerification,
            };
        })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
