import { NextRequest, NextResponse } from 'next/server';
import { getLatestRankingAction } from '@/app/actions/ranking';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/config';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
        return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
    }

    try {
        const data = await getLatestRankingAction(categoryId);

        if (!data) {
            return NextResponse.json(null);
        }

        // Fetch per-user rates if user is logged in
        let userRateMap = new Map<string, number>();
        let hasUserCredentials = false;

        const session = await auth();
        if (session?.user?.id) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { rakutenAffiliateId: true },
            });
            hasUserCredentials = !!user?.rakutenAffiliateId;

            if (hasUserCredentials) {
                const itemKeys = data.items.map(i => i.itemKey);
                const userRates = await prisma.userAffiliateRate.findMany({
                    where: {
                        userId: session.user.id,
                        itemKey: { in: itemKeys },
                    },
                    select: { itemKey: true, affiliateRate: true },
                });
                userRateMap = new Map(userRates.map(r => [r.itemKey, r.affiliateRate]));
            }
        }

        return NextResponse.json({
            categoryId,
            snapshot: data.snapshot,
            hasUserCredentials,
            items: data.items.map(item => ({
                ...item,
                userRate: userRateMap.get(item.itemKey) ?? null,
            })),
        });
    } catch (error) {
        console.error('Error fetching category data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
