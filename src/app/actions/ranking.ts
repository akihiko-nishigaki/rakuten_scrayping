'use server';

import { prisma } from '@/lib/prisma';
import { SnapshotItem, VerifiedRateCurrent } from '@prisma/client';

export type RankingItemWithVerification = SnapshotItem & {
    verifiedRate: VerifiedRateCurrent | null;
    diff: number | null;
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
 * Get the LATEST snapshot's ranking items (Dashboard default view)
 */
export async function getLatestRankingAction(categoryId?: string) {
    const where: any = { status: 'SUCCESS' };
    if (categoryId) where.categoryId = categoryId;

    const latest = await prisma.rankingSnapshot.findFirst({
        where,
        orderBy: { capturedAt: 'desc' },
    });

    if (!latest) return null;

    const items = await getRankingItemsAction(latest.id);
    return { snapshot: latest, items };
}
