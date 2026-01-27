import { NextRequest, NextResponse } from 'next/server';
import { RankingIngestor } from '@/lib/ingestor/rankingIngestor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // In a real scenario, you might check for an API key or Admin session here
        const ingestor = new RankingIngestor(
            process.env.RAKUTEN_APP_ID || "PLACEHOLDER_APP_ID",
            process.env.RAKUTEN_AFFILIATE_ID
        );

        const results = await ingestor.ingestAllConfiguredCategories();

        return NextResponse.json({
            success: true,
            message: "Ingestion completed",
            results
        });
    } catch (error: any) {
        console.error("Ingestion Trigger Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
