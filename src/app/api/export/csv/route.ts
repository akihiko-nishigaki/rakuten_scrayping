import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RankingSnapshot, SnapshotItem } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // const searchParams = req.nextUrl.searchParams;
    // const snapshotId = searchParams.get('snapshotId');

    // if (!snapshotId) {
    //   return NextResponse.json({ error: 'Missing snapshotId' }, { status: 400 });
    // }

    // // Fetch Items
    // const items = await prisma.snapshotItem.findMany({
    //   where: { snapshotId },
    //   orderBy: { rank: 'asc' }
    // });

    // // Fetch verified rates for efficient joining
    // const itemKeys = items.map(i => i.itemKey);
    // const verifiedRates = await prisma.verifiedRateCurrent.findMany({
    //   where: { itemKey: { in: itemKeys } }
    // });
    // const verifiedMap = new Map(verifiedRates.map(v => [v.itemKey, v]));

    // // Build CSV
    // const header = ['Rank', 'ItemName', 'Shop', 'ItemCode', 'ApiRate', 'VerifiedRate', 'Diff', 'VerificationDate', 'ItemUrl'].join(',') + '\n';

    // const rows = items.map(item => {
    //   const v = verifiedMap.get(item.itemKey);
    //   const vRate = v ? v.verifiedRate : '';
    //   const diff = (item.apiRate && v) ? (v.verifiedRate - item.apiRate).toFixed(2) : '';
    //   const vDate = v ? v.updatedAt.toISOString() : '';

    //   return [
    //     item.rank,
    //     `"${item.title.replace(/"/g, '""')}"`, // Escape quotes
    //     `"${item.shopName}"`,
    //     item.itemKey,
    //     item.apiRate ?? '',
    //     vRate,
    //     diff,
    //     vDate,
    //     item.itemUrl
    //   ].join(',');
    // }).join('\n');

    // return new NextResponse(header + rows, {
    //   headers: {
    //     'Content-Type': 'text/csv',
    //     'Content-Disposition': `attachment; filename="ranking_${snapshotId}.csv"`
    //   }
    // });
    return NextResponse.json({ ok: true });
}
