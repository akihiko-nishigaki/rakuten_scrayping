import { NextRequest, NextResponse } from 'next/server';
import {
    getCachedIds,
    cacheIds,
    fetchIdsFromUrl,
    buildAffiliateUrl,
    type ShopItemIds,
} from '@/lib/rakuten/affiliateIds';

// In-memory cache for the current process (avoids DB hit on repeated clicks)
const memoryCache = new Map<string, ShopItemIds>();

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const itemUrl = searchParams.get('itemUrl');
    const itemKey = searchParams.get('itemKey');

    if (!itemUrl) {
        return NextResponse.json({ error: 'itemUrl is required' }, { status: 400 });
    }

    const cacheKey = itemKey || itemUrl;
    let ids: ShopItemIds | null = null;

    // Try 1: In-memory cache (fastest)
    ids = memoryCache.get(cacheKey) ?? null;

    // Try 2: DB cache (populated during ingestion)
    if (!ids && itemKey) {
        ids = await getCachedIds(itemKey);
        if (ids) {
            memoryCache.set(cacheKey, ids);
        }
    }

    // Try 3: Real-time fetch and extract from item page
    if (!ids) {
        ids = await fetchIdsFromUrl(itemUrl);
        if (ids) {
            memoryCache.set(cacheKey, ids);
            // Also persist to DB for future use
            if (itemKey) {
                cacheIds(itemKey, ids).catch(() => {});
            }
        }
    }

    if (!ids) {
        // Fallback: open the item page directly
        return NextResponse.redirect(itemUrl, { headers: NO_CACHE_HEADERS });
    }

    const affiliateUrl = buildAffiliateUrl(ids);
    return NextResponse.redirect(affiliateUrl, { headers: NO_CACHE_HEADERS });
}
