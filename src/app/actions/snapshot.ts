'use server';

import { prisma } from '@/lib/prisma';

export async function getSnapshotsAction(options?: {
    categoryId?: string;
    limit?: number;
    offset?: number;
}) {
    const { categoryId, limit = 20, offset = 0 } = options || {};

    const where = categoryId ? { categoryId } : {};

    const [snapshots, total] = await Promise.all([
        prisma.rankingSnapshot.findMany({
            where,
            orderBy: { capturedAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                _count: {
                    select: { items: true }
                }
            }
        }),
        prisma.rankingSnapshot.count({ where }),
    ]);

    return {
        snapshots,
        total,
        hasMore: offset + snapshots.length < total,
    };
}

export async function getSnapshotDetailAction(snapshotId: string) {
    const snapshot = await prisma.rankingSnapshot.findUnique({
        where: { id: snapshotId },
        include: {
            items: {
                orderBy: { rank: 'asc' },
            },
        },
    });

    if (!snapshot) return null;

    // Get verified rates for comparison
    const itemKeys = snapshot.items.map(i => i.itemKey);
    const verifiedRates = await prisma.verifiedRateCurrent.findMany({
        where: { itemKey: { in: itemKeys } }
    });

    const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v.verifiedRate]));

    const itemsWithVerification = snapshot.items.map(item => ({
        ...item,
        verifiedRate: verifiedMap.get(item.itemKey) ?? null,
        diff: item.apiRate !== null && verifiedMap.has(item.itemKey)
            ? (verifiedMap.get(item.itemKey)! - item.apiRate)
            : null,
    }));

    return {
        ...snapshot,
        items: itemsWithVerification,
    };
}

export async function getSnapshotStatsAction() {
    const [total, successCount, errorCount, latestSnapshot] = await Promise.all([
        prisma.rankingSnapshot.count(),
        prisma.rankingSnapshot.count({ where: { status: 'SUCCESS' } }),
        prisma.rankingSnapshot.count({ where: { status: 'ERROR' } }),
        prisma.rankingSnapshot.findFirst({
            orderBy: { capturedAt: 'desc' },
        }),
    ]);

    const categoryStats = await prisma.rankingSnapshot.groupBy({
        by: ['categoryId'],
        _count: { id: true },
    });

    return {
        total,
        successCount,
        errorCount,
        latestCapturedAt: latestSnapshot?.capturedAt ?? null,
        categoryBreakdown: categoryStats.map(s => ({
            categoryId: s.categoryId,
            count: s._count.id,
        })),
    };
}

export async function compareSnapshotsAction(snapshotId1: string, snapshotId2: string) {
    const [snapshot1, snapshot2] = await Promise.all([
        prisma.rankingSnapshot.findUnique({
            where: { id: snapshotId1 },
            include: { items: { orderBy: { rank: 'asc' } } },
        }),
        prisma.rankingSnapshot.findUnique({
            where: { id: snapshotId2 },
            include: { items: { orderBy: { rank: 'asc' } } },
        }),
    ]);

    if (!snapshot1 || !snapshot2) {
        throw new Error('Snapshot not found');
    }

    const items1Map = new Map(snapshot1.items.map(i => [i.itemKey, i]));
    const items2Map = new Map(snapshot2.items.map(i => [i.itemKey, i]));

    const allKeys = new Set([...items1Map.keys(), ...items2Map.keys()]);

    const comparison = Array.from(allKeys).map(itemKey => {
        const item1 = items1Map.get(itemKey);
        const item2 = items2Map.get(itemKey);

        return {
            itemKey,
            title: item1?.title || item2?.title || '',
            rank1: item1?.rank ?? null,
            rank2: item2?.rank ?? null,
            rankChange: item1 && item2 ? item1.rank - item2.rank : null,
            apiRate1: item1?.apiRate ?? null,
            apiRate2: item2?.apiRate ?? null,
            isNew: !item1 && !!item2,
            isDropped: !!item1 && !item2,
        };
    });

    return {
        snapshot1: { id: snapshot1.id, capturedAt: snapshot1.capturedAt },
        snapshot2: { id: snapshot2.id, capturedAt: snapshot2.capturedAt },
        comparison: comparison.sort((a, b) => {
            // Sort by rank in snapshot2, then by rank in snapshot1
            if (a.rank2 !== null && b.rank2 !== null) return a.rank2 - b.rank2;
            if (a.rank2 !== null) return -1;
            if (b.rank2 !== null) return 1;
            if (a.rank1 !== null && b.rank1 !== null) return a.rank1 - b.rank1;
            return 0;
        }),
    };
}
