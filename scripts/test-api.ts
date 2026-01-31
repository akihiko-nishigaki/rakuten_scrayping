import 'dotenv/config';

const RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";

async function testApi() {
    const appId = process.env.RAKUTEN_APP_ID;

    if (!appId) {
        console.error('RAKUTEN_APP_ID is not set');
        return;
    }

    console.log('Testing Rakuten Ranking API...\n');

    const categories = [
        { id: "0", name: "総合" },
        { id: "100227", name: "食品" },
        { id: "100371", name: "レディースファッション" },
    ];

    for (const cat of categories) {
        console.log(`\n[${cat.name}] (${cat.id})`);
        let totalItems = 0;

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
                    console.log(`  Page ${page}: ERROR - ${data.error}`);
                    break;
                }

                const itemCount = data.Items?.length || 0;
                totalItems += itemCount;
                console.log(`  Page ${page}: ${itemCount} items`);

                if (itemCount < 30) break;
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.log(`  Page ${page}: FETCH ERROR`);
                break;
            }
        }
        console.log(`  Total: ${totalItems} items`);
    }
}

testApi().catch(console.error);
