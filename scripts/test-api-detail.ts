import 'dotenv/config';

const RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";

async function testApi() {
    const appId = process.env.RAKUTEN_APP_ID;

    if (!appId) {
        console.error('RAKUTEN_APP_ID is not set');
        return;
    }

    console.log('Checking rank distribution in API response...\n');

    const params = new URLSearchParams({
        applicationId: appId,
        formatVersion: "2",
        genreId: "0", // 総合
        page: "1",
    });

    const res = await fetch(`${RAKUTEN_API_ENDPOINT}?${params.toString()}`);
    const data = await res.json();

    if (data.error) {
        console.log('ERROR:', data.error);
        return;
    }

    console.log('Page 1 items (総合):');
    console.log('─'.repeat(60));

    for (const itemWrapper of data.Items) {
        const item = itemWrapper.Item || itemWrapper;
        console.log(`Rank ${String(item.rank).padStart(3)}: ${item.itemName?.substring(0, 40)}...`);
    }

    console.log('─'.repeat(60));
    console.log(`Total items in page 1: ${data.Items.length}`);

    // Check if rank 1 exists
    const ranks = data.Items.map((i: any) => (i.Item || i).rank);
    console.log(`\nRank range: ${Math.min(...ranks)} - ${Math.max(...ranks)}`);
    console.log(`Has rank 1: ${ranks.includes(1)}`);
}

testApi().catch(console.error);
