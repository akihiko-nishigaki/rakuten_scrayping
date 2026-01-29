import { NextRequest, NextResponse } from 'next/server';
import { RateScraperService } from '@/lib/scraper/rateScraperService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

/**
 * POST /api/scrape
 * Scrape actual affiliate rates from Rakuten
 *
 * Body options:
 * - { mode: 'snapshot', snapshotId: string } - Scrape all items in a snapshot
 * - { mode: 'pending', limit?: number } - Scrape pending verification tasks
 * - { mode: 'items', itemKeys: string[] } - Scrape specific items
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mode } = body;

        let result;

        switch (mode) {
            case 'snapshot':
                if (!body.snapshotId) {
                    return NextResponse.json(
                        { error: 'snapshotId is required for snapshot mode' },
                        { status: 400 }
                    );
                }
                result = await RateScraperService.scrapeSnapshotItems(body.snapshotId);
                break;

            case 'pending':
                const limit = body.limit || 50;
                result = await RateScraperService.scrapePendingTasks(limit);
                break;

            case 'items':
                if (!body.itemKeys || !Array.isArray(body.itemKeys)) {
                    return NextResponse.json(
                        { error: 'itemKeys array is required for items mode' },
                        { status: 400 }
                    );
                }
                result = await RateScraperService.scrapeByItemKeys(body.itemKeys);
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid mode. Use: snapshot, pending, or items' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('Scrape API error:', error);
        return NextResponse.json(
            { error: error.message || 'Scraping failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/scrape
 * Get scraping status or trigger a quick test
 */
export async function GET() {
    return NextResponse.json({
        status: 'ready',
        endpoints: {
            'POST /api/scrape': {
                modes: {
                    snapshot: 'Scrape all items in a snapshot',
                    pending: 'Scrape pending verification tasks',
                    items: 'Scrape specific item keys'
                },
                examples: [
                    { mode: 'snapshot', snapshotId: 'xxx' },
                    { mode: 'pending', limit: 10 },
                    { mode: 'items', itemKeys: ['item1', 'item2'] }
                ]
            }
        }
    });
}
