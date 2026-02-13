import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel serverless: run in Tokyo region (close to Rakuten servers)
export const preferredRegion = 'hnd1';
export const maxDuration = 30;

const FETCH_TIMEOUT_MS = 7000;

// In-memory caches
const shopIdCache = new Map<string, string>();    // shopCode -> shopId
const affiliateCache = new Map<string, string>(); // itemUrl -> affiliateUrl

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
};

/**
 * Extract shopId from shop page HTML (www.rakuten.co.jp/{shopCode}/).
 */
function extractShopIdFromHtml(html: string): string | null {
    // Pattern: "shopId":"123456" or shopId: 123456 or shop_id: "123456"
    const m = html.match(/shop_?[Ii]d['":\s=]+['"]?(\d{4,})['"]?/);
    return m?.[1] ?? null;
}

/**
 * Get shopId: in-memory cache → DB → shop page fetch.
 * Stores result in both DB and in-memory cache for future use.
 */
async function fetchShopId(shopCode: string): Promise<string | null> {
    // 1. In-memory cache (instant)
    const memCached = shopIdCache.get(shopCode);
    if (memCached) return memCached;

    // 2. DB cache (fast)
    try {
        const dbMapping = await prisma.shopIdMapping.findUnique({
            where: { shopCode },
        });
        if (dbMapping) {
            shopIdCache.set(shopCode, dbMapping.shopId);
            return dbMapping.shopId;
        }
    } catch (e) {
        console.warn(`[rate-check] DB lookup error for shopCode ${shopCode}:`, e);
    }

    // 3. Fetch from shop page (slow, ~5s)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const shopPageUrl = `https://www.rakuten.co.jp/${shopCode}/`;
        const res = await fetch(shopPageUrl, {
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
            console.warn(`[rate-check] shop page fetch failed: ${res.status} for ${shopCode}`);
            return null;
        }

        const html = await res.text();
        const shopId = extractShopIdFromHtml(html);

        if (shopId) {
            // Store in both caches
            shopIdCache.set(shopCode, shopId);
            try {
                await prisma.shopIdMapping.upsert({
                    where: { shopCode },
                    update: { shopId },
                    create: { shopCode, shopId },
                });
            } catch (e) {
                console.warn(`[rate-check] DB save error for shopCode ${shopCode}:`, e);
            }
            return shopId;
        }

        console.warn(`[rate-check] no shopId extracted from shop page for ${shopCode}`);
        return null;
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
            console.warn(`[rate-check] shop page timeout for ${shopCode}`);
        } else {
            console.warn(`[rate-check] shop page error for ${shopCode}:`, e);
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Build affiliate URL using itemKey + itemUrl + shop page fetch.
 * Primary strategy for Vercel where item pages are blocked.
 *
 * itemKey formats: "shopCode:12345" or "book:book:12345" (multi-colon)
 * numericItemId is always the last segment after the last colon.
 * shopCode is extracted from itemUrl for reliability.
 */
async function resolveViaShopPage(itemUrl: string, itemKey: string): Promise<string | null> {
    // Extract shopCode from item URL (handles multi-colon itemKeys like "book:book:12345")
    const urlMatch = itemUrl.match(/item\.rakuten\.co\.jp\/([^/?]+)\//);
    const shopCode = urlMatch?.[1];

    // Extract numericItemId from the last segment of itemKey
    const lastColon = itemKey.lastIndexOf(':');
    const numericItemId = lastColon >= 0 ? itemKey.substring(lastColon + 1) : null;

    if (!shopCode || !numericItemId || !/^\d+$/.test(numericItemId)) return null;

    const shopId = await fetchShopId(shopCode);
    if (!shopId) return null;

    const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=1${shopId}&item_id=${numericItemId}&l-id=af_header_cta_link`;
    affiliateCache.set(itemUrl, affiliateUrl);
    return affiliateUrl;
}

/**
 * Fallback: Extract shopId and itemId from item page HTML (works locally, blocked on Vercel).
 */
async function resolveViaItemPage(itemUrl: string): Promise<string | null> {
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

        if (!res.ok) return null;

        const html = await res.text();

        // Try multiple extraction strategies
        const s1 = html.match(/"shopId"\s*:\s*"?(\d+)"?/);
        const i1 = html.match(/"itemId"\s*:\s*"?(\d+)"?/);
        if (s1 && i1) {
            const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=1${s1[1]}&item_id=${i1[1]}&l-id=af_header_cta_link`;
            affiliateCache.set(itemUrl, affiliateUrl);
            return affiliateUrl;
        }

        const s2 = html.match(/"shop_id"\s*:\s*"?(\d+)"?/);
        const i2 = html.match(/"item_id"\s*:\s*"?(\d+)"?/);
        if (s2 && i2) {
            const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=1${s2[1]}&item_id=${i2[1]}&l-id=af_header_cta_link`;
            affiliateCache.set(itemUrl, affiliateUrl);
            return affiliateUrl;
        }

        return null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Resolve affiliate URL for an item. Tries shop page first (Vercel-compatible), then item page fallback.
 */
async function resolveAffiliateUrl(itemUrl: string, itemKey?: string): Promise<string | null> {
    // Check cache
    const cached = affiliateCache.get(itemUrl);
    if (cached) return cached;

    // Strategy 1: Use itemKey + shop page (works on Vercel)
    if (itemKey) {
        const url = await resolveViaShopPage(itemUrl, itemKey);
        if (url) return url;
    }

    // Strategy 2: Extract shopCode from URL + use shop page
    if (!itemKey) {
        const urlMatch = itemUrl.match(/item\.rakuten\.co\.jp\/([^/]+)\/([^/?]+)/);
        if (urlMatch) {
            const shopCode = urlMatch[1];
            const shopId = await fetchShopId(shopCode);
            if (shopId) {
                // Without itemKey, we don't have the numeric itemId.
                // Fall through to item page fetch.
            }
        }
    }

    // Strategy 3: Fetch item page directly (works locally, blocked on Vercel)
    const url = await resolveViaItemPage(itemUrl);
    if (url) return url;

    return null;
}

// ─── Route Handlers ───

/**
 * GET /api/rate-check?itemUrl=...&itemKey=...&debug=1
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const itemUrl = searchParams.get('itemUrl');
    const itemKey = searchParams.get('itemKey');
    const isDebug = searchParams.get('debug') === '1';

    if (!itemUrl) {
        return NextResponse.json({ error: 'itemUrl is required' }, { status: 400 });
    }

    if (isDebug) {
        return await handleDebug(itemUrl, itemKey);
    }

    const affiliateUrl = await resolveAffiliateUrl(itemUrl, itemKey ?? undefined);

    if (affiliateUrl) {
        return NextResponse.json({ success: true, affiliateUrl }, { headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({ success: false, fallback: itemUrl }, { headers: NO_CACHE_HEADERS });
}

/**
 * POST /api/rate-check
 * Batch prefetch: accepts { items: [{ itemUrl, itemKey }] }
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const items: { itemUrl: string; itemKey?: string }[] = body.items ?? [];

    if (items.length === 0) {
        return NextResponse.json({ results: {} });
    }

    const results: Record<string, string | null> = {};

    // Return cached results immediately
    for (const item of items) {
        const cached = affiliateCache.get(item.itemUrl);
        if (cached) results[item.itemUrl] = cached;
    }

    // Resolve uncached items concurrently, 3 at a time
    const uncached = items.filter(i => !affiliateCache.has(i.itemUrl));
    const CONCURRENCY = 3;
    for (let i = 0; i < uncached.length; i += CONCURRENCY) {
        const batch = uncached.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (item) => {
            const url = await resolveAffiliateUrl(item.itemUrl, item.itemKey);
            results[item.itemUrl] = url;
        });
        await Promise.all(promises);
    }

    return NextResponse.json({ results }, { headers: NO_CACHE_HEADERS });
}

// ─── Debug Handler ───

async function handleDebug(itemUrl: string, itemKey: string | null) {
    const diag: Record<string, unknown> = {
        itemUrl,
        itemKey,
        timestamp: new Date().toISOString(),
        runtime: process.env.VERCEL ? 'vercel' : 'local',
        region: process.env.VERCEL_REGION ?? 'unknown',
    };

    // Test: resolve via shop page (primary Vercel strategy)
    const urlMatch = itemUrl.match(/item\.rakuten\.co\.jp\/([^/]+)\//);
    const shopCode = itemKey?.split(':')[0] ?? urlMatch?.[1];
    const numericItemId = itemKey?.split(':')[1];

    if (shopCode) {
        const shopStart = Date.now();
        const shopId = await fetchShopId(shopCode);
        diag.shopPageTest = {
            shopCode,
            shopId: shopId ?? 'failed',
            timeMs: Date.now() - shopStart,
        };

        if (shopId && numericItemId) {
            diag.affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=1${shopId}&item_id=${numericItemId}&l-id=af_header_cta_link`;
            diag.success = true;
        } else {
            diag.success = false;
            diag.note = !numericItemId
                ? 'itemKey required for numericItemId (pass itemKey param)'
                : 'shopId extraction failed';
        }
    } else {
        diag.success = false;
        diag.note = 'Could not extract shopCode from URL or itemKey';
    }

    return NextResponse.json(diag, { headers: NO_CACHE_HEADERS });
}
