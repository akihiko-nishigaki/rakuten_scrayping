import 'dotenv/config';

const RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";

async function testApi() {
    const appId = process.env.RAKUTEN_APP_ID;

    if (!appId) {
        console.error('RAKUTEN_APP_ID is not set');
        return;
    }

    console.log('Testing Rakuten Ranking API (force all pages)...\n');

    const categories = [
        { id: "0", name: "総合" },
        { id: "100227", name: "食品" },
    ];

    for (const cat of categories) {
        console.log(`\n[${cat.name}] (${cat.id})`);

        for (let page = 1; page <= 4; page++) {
            const params = new URLSearchParams({
                applicationId: appId,
                formatVersion: "2",
                genreId: cat.id,
                page: String(page),
            });

            try {
                const res = await fetch(`${RAKUTEN_API_ENDPOINT}?${params.toString()}`);
                const data = await res.json();

                if (data.error) {
                    console.log(`  Page ${page}: ERROR - ${data.error}: ${data.error_description}`);
                } else {
                    const itemCount = data.Items?.length || 0;
                    console.log(`  Page ${page}: ${itemCount} items`);

                    if (itemCount > 0 && data.Items[0]) {
                        const firstItem = data.Items[0].Item || data.Items[0];
                        console.log(`    First item rank: ${firstItem.rank}, name: ${firstItem.itemName?.substring(0, 30)}...`);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.log(`  Page ${page}: FETCH ERROR - ${error}`);
            }
        }
    }
}

testApi().catch(console.error);
