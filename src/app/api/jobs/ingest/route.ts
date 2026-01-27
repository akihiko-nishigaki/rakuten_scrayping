import { NextRequest, NextResponse } from 'next/server';
import { RankingIngestor } from '@/lib/ingestor/rankingIngestor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Simple Authorization check (TODO: Replace with proper Secret Manager / Token check)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appId = process.env.RAKUTEN_APP_ID;
    const affiliateId = process.env.RAKUTEN_AFFILIATE_ID; // Optional

    if (!appId) {
        return NextResponse.json({ error: 'RAKUTEN_APP_ID not configured' }, { status: 500 });
    }

    // try {
    //     const ingestor = new RankingIngestor(appId, affiliateId);
    //     const results = await ingestor.ingestAllConfiguredCategories();

    //     return NextResponse.json({
    //         ok: true,
    //         results,
    //         timestamp: new Date().toISOString(),
    //     });

    // } catch (error: any) {
    //     console.error("Ingest Job Failed:", error);
    //     return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    // }
    return NextResponse.json({ ok: true, status: "Debugging Build" });
}
