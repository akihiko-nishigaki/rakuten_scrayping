import { prisma } from '@/lib/prisma';

export interface ShopItemIds {
    shopId: string;
    itemId: string;
}

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
export function extractIdsFromHtml(html: string): ShopItemIds | null {
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

/**
 * Fetch a URL and extract shopId/itemId from the HTML response.
 */
export async function fetchIdsFromUrl(url: string): Promise<ShopItemIds | null> {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9',
                'Accept-Encoding': 'identity',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
            console.error(`[affiliateIds] HTTP ${res.status} for ${url}`);
            return null;
        }

        const html = await res.text();
        return extractIdsFromHtml(html);
    } catch (e) {
        console.error(`[affiliateIds] Fetch error for ${url}:`, e);
        return null;
    }
}

/**
 * Look up cached affiliate IDs from the database.
 */
export async function getCachedIds(itemKey: string): Promise<ShopItemIds | null> {
    try {
        const cached = await prisma.affiliateIdCache.findUnique({
            where: { itemKey },
        });
        if (cached) return { shopId: cached.shopId, itemId: cached.itemId };
        return null;
    } catch {
        return null;
    }
}

/**
 * Store affiliate IDs in the cache.
 */
export async function cacheIds(itemKey: string, ids: ShopItemIds): Promise<void> {
    try {
        await prisma.affiliateIdCache.upsert({
            where: { itemKey },
            update: { shopId: ids.shopId, itemId: ids.itemId },
            create: { itemKey, shopId: ids.shopId, itemId: ids.itemId },
        });
    } catch (e) {
        console.error(`[affiliateIds] Cache write error for ${itemKey}:`, e);
    }
}

/**
 * Build the Rakuten affiliate management URL from shopId and itemId.
 */
export function buildAffiliateUrl(ids: ShopItemIds): string {
    const meId = `1${ids.shopId}`;
    return `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=${meId}&item_id=${ids.itemId}&l-id=af_header_cta_link`;
}
