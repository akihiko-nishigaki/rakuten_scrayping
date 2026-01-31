import 'dotenv/config';
import { RankingIngestor } from '../src/lib/ingestor/rankingIngestor';

async function runIngest() {
    const appId = process.env.RAKUTEN_APP_ID;

    if (!appId) {
        console.error('RAKUTEN_APP_ID is not set');
        return;
    }

    console.log('Starting ingest...\n');

    const ingestor = new RankingIngestor(appId);
    const results = await ingestor.ingestAllConfiguredCategories();

    console.log('\n=== Ingest Complete ===');
    for (const r of results) {
        if (r.status === 'SUCCESS') {
            console.log(`[${r.categoryId}] SUCCESS: ${r.count} items`);
        } else {
            console.log(`[${r.categoryId}] ERROR: ${r.error}`);
        }
    }
}

runIngest().catch(console.error);
