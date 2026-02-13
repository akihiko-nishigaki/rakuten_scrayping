import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel serverless function timeout (seconds) - Hobby plan max is 60s
export const maxDuration = 30;

interface ShopItemIds {
    shopId: string;
    itemId: string;
}

// In-memory cache: itemUrl -> { shopId, itemId }
const cache = new Map<string, ShopItemIds>();

/**
 * Recursively search for a numeric value by key name in a nested object.
 */
function findNumericValue(obj: unknown, targetKey: string, depth = 0): string | null {
    if (depth > 15 || !obj || typeof obj !== 'object') return null;

    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        if (key === targetKey) {
            const str = String(record[key]);
            if (/^\d+$/.test(str)) return str;
        }
        if (typeof record[key] === 'object' && record[key] !== null) {
            const found = findNumericValue(record[key], targetKey, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Extract shopId and itemId from HTML using multiple strategies.
 */
function extractIdsFromHtml(html: string): ShopItemIds | null {
    // Strategy 1: JSON property "shopId" / "itemId" (double-quoted, camelCase)
    const s1 = html.match(/"shopId"\s*:\s*"?(\d+)"?/);
    const i1 = html.match(/"itemId"\s*:\s*"?(\d+)"?/);
    if (s1 && i1) return { shopId: s1[1], itemId: i1[1] };

    // Strategy 2: snake_case "shop_id" / "item_id"
    const s2 = html.match(/"shop_id"\s*:\s*"?(\d+)"?/);
    const i2 = html.match(/"item_id"\s*:\s*"?(\d+)"?/);
    if (s2 && i2) return { shopId: s2[1], itemId: i2[1] };

    // Strategy 3: Parse __NEXT_DATA__ JSON and search recursively
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
        try {
            const data = JSON.parse(nextDataMatch[1]);
            const shopId = findNumericValue(data, 'shopId') ?? findNumericValue(data, 'shop_id');
            const itemId = findNumericValue(data, 'itemId') ?? findNumericValue(data, 'item_id');
            if (shopId && itemId) return { shopId, itemId };
        } catch { /* parse error, continue */ }
    }

    // Strategy 4: RAT analytics tracking (si = shopId, ii = itemId)
    const siMatch = html.match(/["']si["']\s*:\s*["'](\d+)["']/);
    const iiMatch = html.match(/["']ii["']\s*:\s*["'](\d+)["']/);
    if (siMatch && iiMatch) return { shopId: siMatch[1], itemId: iiMatch[1] };

    // Strategy 5: Generic script data with application/json type
    const jsonScripts = html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g);
    for (const m of jsonScripts) {
        try {
            const data = JSON.parse(m[1]);
            const shopId = findNumericValue(data, 'shopId') ?? findNumericValue(data, 'shop_id');
            const itemId = findNumericValue(data, 'itemId') ?? findNumericValue(data, 'item_id');
            if (shopId && itemId) return { shopId, itemId };
        } catch { /* continue */ }
    }

    // Strategy 6: Broader assignment patterns (shopId = 12345, shopId: 12345)
    const sAssign = html.match(/shopId\s*[=:]\s*["']?(\d{4,})["']?/);
    const iAssign = html.match(/itemId\s*[=:]\s*["']?(\d{4,})["']?/);
    if (sAssign && iAssign) return { shopId: sAssign[1], itemId: iAssign[1] };

    return null;
}

const FETCH_TIMEOUT_MS = 7000;

async function fetchIds(itemUrl: string): Promise<ShopItemIds | null> {
    const cached = cache.get(itemUrl);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(itemUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9',
                'Accept-Encoding': 'identity',
            },
            redirect: 'follow',
            signal: controller.signal,
        });

        if (!res.ok) {
            console.warn(`[rate-check] fetch failed: ${res.status} for ${itemUrl}`);
            return null;
        }

        const html = await res.text();
        const ids = extractIdsFromHtml(html);

        if (ids) {
            cache.set(itemUrl, ids);
            return ids;
        }

        console.warn(`[rate-check] no IDs extracted from ${itemUrl}`);
        return null;
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
            console.warn(`[rate-check] timeout after ${FETCH_TIMEOUT_MS}ms for ${itemUrl}`);
        } else {
            console.warn(`[rate-check] fetch error for ${itemUrl}:`, e);
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Build affiliate URL from cached IDs. Returns null if not cached.
 */
function getAffiliateUrlFromCache(itemUrl: string): string | null {
    const ids = cache.get(itemUrl);
    if (!ids) return null;
    return `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=1${ids.shopId}&item_id=${ids.itemId}&l-id=af_header_cta_link`;
}

/**
 * Fallback: Try to resolve IDs using the original API response stored in DB.
 * The rawJson may contain the original affiliate-wrapped itemUrl which
 * can be fetched for a different HTML response.
 */
async function fetchIdsFromDb(itemKey: string, currentItemUrl: string): Promise<ShopItemIds | null> {
    try {
        const snapshotItem = await prisma.snapshotItem.findFirst({
            where: { itemKey },
            orderBy: { snapshot: { capturedAt: 'desc' } },
            select: { rawJson: true },
        });

        if (!snapshotItem?.rawJson) return null;

        const raw = snapshotItem.rawJson as Record<string, unknown>;
        const originalItemUrl = raw.itemUrl as string | undefined;

        if (!originalItemUrl || originalItemUrl === currentItemUrl) return null;

        // The original API itemUrl might be affiliate-wrapped.
        // Try extracting the direct URL from the pc= parameter.
        try {
            const url = new URL(originalItemUrl);
            const pcParam = url.searchParams.get('pc');
            if (pcParam) {
                const directUrl = decodeURIComponent(pcParam);
                if (directUrl !== currentItemUrl) {
                    const ids = await fetchIds(directUrl);
                    if (ids) return ids;
                }
            }
        } catch { /* not a valid URL, continue */ }

        // Try fetching the original API URL itself (affiliate wrapper page)
        return await fetchIds(originalItemUrl);
    } catch (e) {
        console.error(`[rate-check] DB lookup error for ${itemKey}:`, e);
        return null;
    }
}

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
};

/**
 * GET /api/rate-check?itemUrl=...&itemKey=...&debug=1
 * Returns JSON with affiliate URL (used by client-side button).
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const itemUrl = searchParams.get('itemUrl');
    const itemKey = searchParams.get('itemKey');

    if (!itemUrl) {
        return NextResponse.json({ error: 'itemUrl is required' }, { status: 400 });
    }

    // Fast path: return from cache immediately
    const cachedUrl = getAffiliateUrlFromCache(itemUrl);
    if (cachedUrl) {
        return NextResponse.json({ success: true, affiliateUrl: cachedUrl }, { headers: NO_CACHE_HEADERS });
    }

    // Slow path: fetch item page and extract IDs
    let ids = await fetchIds(itemUrl);

    if (!ids && itemKey) {
        ids = await fetchIdsFromDb(itemKey, itemUrl);
    }

    if (!ids) {
        return NextResponse.json({ success: false, fallback: itemUrl }, { headers: NO_CACHE_HEADERS });
    }

    const meId = `1${ids.shopId}`;
    const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=${meId}&item_id=${ids.itemId}&l-id=af_header_cta_link`;

    return NextResponse.json({ success: true, affiliateUrl }, { headers: NO_CACHE_HEADERS });
}

/**
 * POST /api/rate-check
 * Batch prefetch: accepts { items: [{ itemUrl, itemKey }] }
 * Fetches IDs for uncached items concurrently (max 5 at a time).
 * Returns { results: { [itemUrl]: affiliateUrl | null } }
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const items: { itemUrl: string; itemKey?: string }[] = body.items ?? [];

    if (items.length === 0) {
        return NextResponse.json({ results: {} });
    }

    // Filter to only uncached items
    const uncached = items.filter(i => !cache.has(i.itemUrl));
    const results: Record<string, string | null> = {};

    // Return cached results immediately
    for (const item of items) {
        const url = getAffiliateUrlFromCache(item.itemUrl);
        if (url) results[item.itemUrl] = url;
    }

    // Fetch uncached items concurrently, 3 at a time (reduced for Vercel serverless)
    const CONCURRENCY = 3;
    for (let i = 0; i < uncached.length; i += CONCURRENCY) {
        const batch = uncached.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (item) => {
            let ids = await fetchIds(item.itemUrl);
            if (!ids && item.itemKey) {
                ids = await fetchIdsFromDb(item.itemKey, item.itemUrl);
            }
            if (ids) {
                const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=1${ids.shopId}&item_id=${ids.itemId}&l-id=af_header_cta_link`;
                results[item.itemUrl] = affiliateUrl;
            } else {
                results[item.itemUrl] = null;
            }
        });
        await Promise.all(promises);
    }

    return NextResponse.json({ results }, { headers: NO_CACHE_HEADERS });
}
