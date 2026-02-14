import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/cron
 * Shows recent cron job execution status and snapshot data.
 */
export async function GET() {
    try {
        // Recent audit logs for ingest jobs
        const recentJobs = await prisma.auditLog.findMany({
            where: { actionType: 'INGEST_JOB' },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                createdAt: true,
                metaJson: true,
            },
        });

        // Recent snapshots
        const recentSnapshots = await prisma.rankingSnapshot.findMany({
            orderBy: { capturedAt: 'desc' },
            take: 10,
            select: {
                id: true,
                capturedAt: true,
                categoryId: true,
                rankingType: true,
                fetchedCount: true,
                status: true,
                errorMessage: true,
            },
        });

        // Count items in latest snapshot per category
        const snapshotItemCounts: Record<string, number> = {};
        for (const snapshot of recentSnapshots.slice(0, 5)) {
            const count = await prisma.snapshotItem.count({
                where: { snapshotId: snapshot.id },
            });
            snapshotItemCounts[snapshot.id] = count;
        }

        // Sample items from the most recent snapshot
        let sampleItems: { rank: number; itemKey: string; title: string; shopName: string }[] = [];
        if (recentSnapshots.length > 0) {
            sampleItems = await prisma.snapshotItem.findMany({
                where: { snapshotId: recentSnapshots[0].id },
                orderBy: { rank: 'asc' },
                take: 5,
                select: {
                    rank: true,
                    itemKey: true,
                    title: true,
                    shopName: true,
                },
            });
        }

        // Settings
        const settings = await prisma.settings.findFirst({
            select: {
                ingestEnabled: true,
                categories: true,
                rakutenAppId: true,
            },
        });

        // Total counts
        const totalSnapshots = await prisma.rankingSnapshot.count();
        const totalItems = await prisma.snapshotItem.count();
        const totalShopMappings = await prisma.shopIdMapping.count();

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            settings: {
                ingestEnabled: settings?.ingestEnabled ?? 'not found',
                categoriesCount: settings?.categories?.length ?? 0,
                categories: settings?.categories ?? [],
                hasApiKey: !!settings?.rakutenAppId || !!process.env.RAKUTEN_APP_ID,
            },
            totals: {
                snapshots: totalSnapshots,
                items: totalItems,
                shopMappings: totalShopMappings,
            },
            recentJobs: recentJobs.map(j => ({
                id: j.id,
                createdAt: j.createdAt,
                meta: j.metaJson,
            })),
            recentSnapshots: recentSnapshots.map(s => ({
                ...s,
                itemCount: snapshotItemCounts[s.id] ?? '?',
            })),
            sampleItemsFromLatest: sampleItems,
        });
    } catch (e) {
        return NextResponse.json({
            error: e instanceof Error ? e.message : String(e),
        }, { status: 500 });
    }
}
