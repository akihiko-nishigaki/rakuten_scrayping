import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RakutenClient } from '@/lib/rakuten/client';
import { auth } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user-rates?categoryId=0
 *
 * Fetches ranking items using the current user's Rakuten affiliate credentials,
 * saves the per-user rates to the DB, and returns the results.
 * Falls back to system env vars if user has no credentials configured.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                rakutenAppId: true,
                rakutenAffiliateId: true,
            },
        });

        // Determine which credentials to use: user-specific or system default
        const appId = user?.rakutenAppId || process.env.RAKUTEN_APP_ID;
        const affiliateId = user?.rakutenAffiliateId || process.env.RAKUTEN_AFFILIATE_ID;

        if (!appId) {
            return NextResponse.json(
                { error: 'アプリケーションIDが設定されていません。ユーザー設定またはシステム環境変数を確認してください。' },
                { status: 400 }
            );
        }

        if (!affiliateId) {
            return NextResponse.json(
                { error: 'アフィリエイトIDが設定されていません。ユーザー設定またはシステム環境変数を確認してください。' },
                { status: 400 }
            );
        }

        const categoryId = req.nextUrl.searchParams.get('categoryId') || '0';

        const client = new RakutenClient(appId, affiliateId);
        const response = await client.getAllRankings(categoryId, 4);

        // Save per-user rates to DB and build response
        const items = [];
        for (const wrapper of response.Items) {
            const item = (wrapper as any).Item || wrapper;
            const itemKey = item.itemCode as string;
            const rate = parseFloat(item.affiliateRate) || 0;

            // Upsert rate into DB
            if (user?.rakutenAffiliateId) {
                await prisma.userAffiliateRate.upsert({
                    where: {
                        userId_itemKey: { userId: session.user.id, itemKey },
                    },
                    create: {
                        userId: session.user.id,
                        itemKey,
                        affiliateRate: rate,
                    },
                    update: {
                        affiliateRate: rate,
                        fetchedAt: new Date(),
                    },
                });
            }

            items.push({
                rank: item.rank,
                itemCode: item.itemCode,
                itemName: item.itemName,
                itemPrice: item.itemPrice,
                shopName: item.shopName,
                affiliateRate: rate,
                affiliateUrl: item.affiliateUrl,
                itemUrl: item.itemUrl,
            });
        }

        return NextResponse.json({
            ok: true,
            usingUserCredentials: !!(user?.rakutenAffiliateId),
            categoryId,
            itemCount: items.length,
            savedToDb: !!(user?.rakutenAffiliateId),
        });
    } catch (error: any) {
        console.error('User rates fetch failed:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
