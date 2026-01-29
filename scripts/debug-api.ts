/**
 * Debug script to see raw Rakuten API response
 */

import 'dotenv/config';

const RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";

async function main() {
    const appId = process.env.RAKUTEN_APP_ID;
    const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;

    if (!appId) {
        console.log('RAKUTEN_APP_ID not set');
        process.exit(1);
    }

    console.log('App ID:', appId);
    console.log('Affiliate ID:', affiliateId);

    const params = new URLSearchParams({
        applicationId: appId,
        formatVersion: "2",
        genreId: "0", // 総合ランキング
        page: "1",
    });

    if (affiliateId) {
        params.append("affiliateId", affiliateId);
    }

    const url = `${RAKUTEN_API_ENDPOINT}?${params.toString()}`;
    console.log('\nAPI URL:', url);

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        console.log('API Error:', data.error, data.error_description);
        process.exit(1);
    }

    console.log('\n=== Response Summary ===');
    console.log('Title:', data.title);
    console.log('Items count:', data.Items?.length);

    if (data.Items && data.Items.length > 0) {
        console.log('\n=== First 3 Items ===');

        for (let i = 0; i < Math.min(3, data.Items.length); i++) {
            const itemWrapper = data.Items[i];
            const item = itemWrapper.Item || itemWrapper;

            console.log(`\n--- Item ${i + 1} ---`);
            console.log('rank:', item.rank);
            console.log('itemCode:', item.itemCode);
            console.log('itemName:', item.itemName?.slice(0, 50));
            console.log('shopCode:', item.shopCode);
            console.log('shopName:', item.shopName);
            console.log('itemUrl:', item.itemUrl);
            console.log('affiliateUrl:', item.affiliateUrl?.slice(0, 100));
            console.log('affiliateRate:', item.affiliateRate);
        }

        // Save full first item to file
        const fs = await import('fs');
        fs.writeFileSync('debug-api-item.json', JSON.stringify(data.Items[0], null, 2));
        console.log('\n\nFull first item saved to: debug-api-item.json');
    }
}

main().catch(console.error);
