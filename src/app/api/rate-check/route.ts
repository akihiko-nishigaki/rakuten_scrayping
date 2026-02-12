import { NextRequest, NextResponse } from 'next/server';

interface ShopItemIds {
    shopId: string;
    itemId: string;
}

// In-memory cache: itemUrl -> { shopId, itemId }
const cache = new Map<string, ShopItemIds>();

async function fetchIds(itemUrl: string): Promise<ShopItemIds | null> {
    const cached = cache.get(itemUrl);
    if (cached) return cached;

    try {
        const res = await fetch(itemUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ja,en;q=0.9',
            },
        });

        if (!res.ok) return null;

        const html = await res.text();

        // Extract shopId (appears as "shopId":"387193" or "shopId":387193)
        const shopMatch = html.match(/"shopId"\s*:\s*"?(\d+)"?/);
        // Extract itemId (appears as "itemId":10000575 or "itemId":"10000575")
        const itemMatch = html.match(/"itemId"\s*:\s*"?(\d+)"?/);

        if (shopMatch && itemMatch) {
            const ids = { shopId: shopMatch[1], itemId: itemMatch[1] };
            cache.set(itemUrl, ids);
            return ids;
        }

        return null;
    } catch {
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

    if (!itemUrl) {
        return NextResponse.json({ error: 'itemUrl is required' }, { status: 400 });
    }

    const ids = await fetchIds(itemUrl);

    if (!ids) {
        // Fallback: open the item page directly
        return NextResponse.redirect(itemUrl, { headers: NO_CACHE_HEADERS });
    }

    // Construct affiliate URL: me_id = "1" + shopId, item_id = numeric itemId
    const meId = `1${ids.shopId}`;
    const affiliateUrl = `https://affiliate.rakuten.co.jp/link/pc/item?type=item&me_id=${meId}&item_id=${ids.itemId}&l-id=af_header_cta_link`;

    return NextResponse.redirect(affiliateUrl, { headers: NO_CACHE_HEADERS });
}
