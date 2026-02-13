import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

async function fetchIds(itemUrl: string): Promise<ShopItemIds | null> {
    const cached = cache.get(itemUrl);
    if (cached) {
        console.log(`[rate-check] Cache hit for ${itemUrl}:`, cached);
        return cached;
    }

    console.log(`[rate-check] Fetching: ${itemUrl}`);

    try {
        const res = await fetch(itemUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9',
                'Accept-Encoding': 'identity',
            },
            redirect: 'follow',
        });

        console.log(`[rate-check] HTTP ${res.status} for ${itemUrl}, final URL: ${res.url}`);

        if (!res.ok) {
            console.error(`[rate-check] HTTP ${res.status} for ${itemUrl}`);
            return null;
        }

        const html = await res.text();
        console.log(`[rate-check] HTML length: ${html.length}`);

        // Log first shopId/itemId matches for debugging
        const debugShopMatch = html.match(/"shopId"\s*:\s*"?(\d+)"?/);
        const debugItemMatch = html.match(/"itemId"\s*:\s*"?(\d+)"?/);
        console.log(`[rate-check] Regex shopId match: ${debugShopMatch ? debugShopMatch[0] : 'NONE'}`);
        console.log(`[rate-check] Regex itemId match: ${debugItemMatch ? debugItemMatch[0] : 'NONE'}`);

        const ids = extractIdsFromHtml(html);

        if (ids) {
            console.log(`[rate-check] Extracted IDs:`, ids);
            cache.set(itemUrl, ids);
            return ids;
        }

        console.error(`[rate-check] Could not extract IDs from ${itemUrl} (HTML length: ${html.length})`);
        // Log a snippet of HTML to help debug
        const snippet = html.substring(0, 500);
        console.error(`[rate-check] HTML snippet: ${snippet}`);
        return null;
    } catch (e) {
        console.error(`[rate-check] Fetch error for ${itemUrl}:`, e);
        return null;
    }
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

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const itemUrl = searchParams.get('itemUrl');
    const itemKey = searchParams.get('itemKey');

    if (!itemUrl) {
        return NextResponse.json({ error: 'itemUrl is required' }, { status: 400 });
    }

    const debug = searchParams.get('debug') === '1';
    const debugLog: string[] = [];
    const log = (msg: string) => {
        console.log(`[rate-check] ${msg}`);
        debugLog.push(msg);
    };

    log(`Request: itemUrl=${itemUrl}, itemKey=${itemKey}`);

    // Try 1: Fetch item page and extract IDs
    let ids = await fetchIds(itemUrl);

    // Try 2: Look up rawJson from DB and try alternative URLs
    if (!ids && itemKey) {
        log(`Try 1 failed, trying DB fallback for ${itemKey}`);
        ids = await fetchIdsFromDb(itemKey, itemUrl);
    }

    if (!ids) {
        log(`ALL strategies failed. Falling back to item page: ${itemUrl}`);
        if (debug) {
            return NextResponse.json({ success: false, itemUrl, itemKey, fallback: itemUrl, log: debugLog }, { headers: NO_CACHE_HEADERS });
        }
        return NextResponse.redirect(itemUrl, { headers: NO_CACHE_HEADERS });
    }

    // Construct affiliate URL: me_id = "1" + shopId, item_id = numeric itemId
    const meId = `1${ids.shopId}`;
    const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=${meId}&item_id=${ids.itemId}&l-id=af_header_cta_link`;

    log(`SUCCESS: shopId=${ids.shopId}, itemId=${ids.itemId}, affiliateUrl=${affiliateUrl}`);

    if (debug) {
        return NextResponse.json({ success: true, itemUrl, itemKey, shopId: ids.shopId, itemId: ids.itemId, meId, affiliateUrl, log: debugLog }, { headers: NO_CACHE_HEADERS });
    }
    return NextResponse.redirect(affiliateUrl, { headers: NO_CACHE_HEADERS });
}
