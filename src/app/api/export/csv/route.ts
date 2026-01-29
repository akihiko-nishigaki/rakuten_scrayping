import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

function escapeCSV(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const snapshotId = searchParams.get('snapshotId');
    const categoryId = searchParams.get('categoryId');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const exportType = searchParams.get('type') || 'snapshot'; // 'snapshot' | 'all' | 'verified'

    try {
        if (exportType === 'snapshot') {
            // Export single snapshot
            if (!snapshotId) {
                return NextResponse.json({ error: 'Missing snapshotId' }, { status: 400 });
            }

            const snapshot = await prisma.rankingSnapshot.findUnique({
                where: { id: snapshotId },
            });

            if (!snapshot) {
                return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
            }

            const items = await prisma.snapshotItem.findMany({
                where: { snapshotId },
                orderBy: { rank: 'asc' },
            });

            const itemKeys = items.map(i => i.itemKey);
            const verifiedRates = await prisma.verifiedRateCurrent.findMany({
                where: { itemKey: { in: itemKeys } },
            });
            const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v]));

            const header = ['Rank', 'ItemName', 'Shop', 'ItemCode', 'ApiRate', 'VerifiedRate', 'Diff', 'VerificationDate', 'ItemUrl'];
            const rows = items.map(item => {
                const v = verifiedMap.get(item.itemKey);
                const vRate = v ? v.verifiedRate : null;
                const diff = (item.apiRate !== null && v) ? (v.verifiedRate - item.apiRate) : null;
                const vDate = v ? format(new Date(v.updatedAt), 'yyyy-MM-dd HH:mm:ss') : '';

                return [
                    item.rank,
                    escapeCSV(item.title),
                    escapeCSV(item.shopName),
                    item.itemKey,
                    item.apiRate ?? '',
                    vRate ?? '',
                    diff !== null ? diff.toFixed(2) : '',
                    vDate,
                    item.itemUrl,
                ];
            });

            const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
            const filename = `ranking_${snapshot.categoryId}_${format(new Date(snapshot.capturedAt), 'yyyyMMdd_HHmm')}.csv`;

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });

        } else if (exportType === 'all') {
            // Export all snapshots within date range
            const where: any = {};
            if (categoryId) where.categoryId = categoryId;
            if (fromDate) where.capturedAt = { ...where.capturedAt, gte: new Date(fromDate) };
            if (toDate) where.capturedAt = { ...where.capturedAt, lte: new Date(toDate) };

            const snapshots = await prisma.rankingSnapshot.findMany({
                where,
                orderBy: { capturedAt: 'desc' },
                take: 100,
                include: {
                    items: {
                        orderBy: { rank: 'asc' },
                    },
                },
            });

            // Get all item keys for verified rates
            const allItemKeys = new Set<string>();
            snapshots.forEach(s => s.items.forEach(i => allItemKeys.add(i.itemKey)));

            const verifiedRates = await prisma.verifiedRateCurrent.findMany({
                where: { itemKey: { in: Array.from(allItemKeys) } },
            });
            const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v]));

            const header = ['SnapshotDate', 'Category', 'Rank', 'ItemName', 'Shop', 'ItemCode', 'ApiRate', 'VerifiedRate', 'Diff', 'ItemUrl'];
            const rows: string[][] = [];

            for (const snapshot of snapshots) {
                for (const item of snapshot.items) {
                    const v = verifiedMap.get(item.itemKey);
                    const vRate = v ? v.verifiedRate : null;
                    const diff = (item.apiRate !== null && v) ? (v.verifiedRate - item.apiRate) : null;

                    rows.push([
                        format(new Date(snapshot.capturedAt), 'yyyy-MM-dd HH:mm:ss'),
                        snapshot.categoryId,
                        String(item.rank),
                        escapeCSV(item.title),
                        escapeCSV(item.shopName),
                        item.itemKey,
                        item.apiRate !== null ? String(item.apiRate) : '',
                        vRate !== null ? String(vRate) : '',
                        diff !== null ? diff.toFixed(2) : '',
                        item.itemUrl,
                    ]);
                }
            }

            const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
            const filename = `rankings_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });

        } else if (exportType === 'verified') {
            // Export all verified rates
            const verifiedRates = await prisma.verifiedRateCurrent.findMany({
                orderBy: { updatedAt: 'desc' },
            });

            // Get latest snapshot item for each verified rate
            const itemKeys = verifiedRates.map(v => v.itemKey);
            const latestItems = await prisma.snapshotItem.findMany({
                where: { itemKey: { in: itemKeys } },
                orderBy: { snapshot: { capturedAt: 'desc' } },
                distinct: ['itemKey'],
            });
            const itemMap = new Map(latestItems.map(i => [i.itemKey, i]));

            const header = ['ItemKey', 'ItemName', 'Shop', 'ApiRate', 'VerifiedRate', 'Diff', 'EvidenceUrl', 'Note', 'VerifiedAt', 'ItemUrl'];
            const rows = verifiedRates.map(v => {
                const item = itemMap.get(v.itemKey);
                const apiRate = item?.apiRate ?? null;
                const diff = apiRate !== null ? (v.verifiedRate - apiRate) : null;

                return [
                    v.itemKey,
                    escapeCSV(item?.title ?? ''),
                    escapeCSV(item?.shopName ?? ''),
                    apiRate !== null ? String(apiRate) : '',
                    String(v.verifiedRate),
                    diff !== null ? diff.toFixed(2) : '',
                    v.evidenceUrl ?? '',
                    escapeCSV(v.note ?? ''),
                    format(new Date(v.updatedAt), 'yyyy-MM-dd HH:mm:ss'),
                    item?.itemUrl ?? '',
                ];
            });

            const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
            const filename = `verified_rates_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });

    } catch (error: any) {
        console.error('CSV Export Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
