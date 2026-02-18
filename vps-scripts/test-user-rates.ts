/**
 * Test User Affiliate Rates
 * ユーザー毎のアフィリエイト料率フェッチのみをテスト実行するスクリプト
 * Run with: npm run test-rates
 *
 * Options:
 *   --dry-run    DBに保存せず結果を表示のみ
 *   --user=ID    特定ユーザーのみ実行
 *   --category=ID  特定カテゴリのみ実行
 */
import { getPool, getSettings, closePool, getUsersWithAffiliateId, UserWithCredentials, upsertUserAffiliateRate, getLatestSnapshotItemKeys } from './db';
import { RequestScheduler } from './rate-limiter';

const RAKUTEN_API_ENDPOINT_LEGACY = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";
const RAKUTEN_API_ENDPOINT_NEW = "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userIdArg = args.find(a => a.startsWith('--user='))?.split('=')[1];
const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1];

interface RakutenRankingResponse {
    Items: { Item: any }[];
    title: string;
    lastBuildDate: string;
}

async function fetchRanking(scheduler: RequestScheduler, appId: string, genreId: string, page: number, affiliateId?: string, accessKey?: string): Promise<RakutenRankingResponse> {
    return scheduler.enqueue(appId, async () => {
        const params = new URLSearchParams({
            applicationId: appId,
            formatVersion: "2",
            genreId: genreId,
            page: String(page),
            period: "realtime",
        });

        if (accessKey) {
            params.append("accessKey", accessKey);
        }

        if (affiliateId) {
            params.append("affiliateId", affiliateId);
        }

        // Use new endpoint when accessKey is available, legacy endpoint otherwise
        const endpoint = accessKey ? RAKUTEN_API_ENDPOINT_NEW : RAKUTEN_API_ENDPOINT_LEGACY;

        const res = await fetch(`${endpoint}?${params.toString()}`, {
            headers: {
                'Referer': 'http://x162-43-24-83.static.xvps.ne.jp/',
            },
        });

        if (!res.ok) {
            const errorBody = await res.text().catch(() => '');
            throw new Error(`Rakuten API Error: ${res.status} ${res.statusText} - ${errorBody}`);
        }

        const data = await res.json();

        if (data.error) {
            throw new Error(`Rakuten API Error: ${data.error} - ${data.error_description}`);
        }

        return data as RakutenRankingResponse;
    });
}

async function fetchAllRankings(scheduler: RequestScheduler, appId: string, genreId: string, maxPages: number = 4, affiliateId?: string, accessKey?: string): Promise<RakutenRankingResponse> {
    const allItems: any[] = [];
    let title = '';
    let lastBuildDate = '';

    for (let page = 1; page <= maxPages; page++) {
        try {
            console.log(`    Fetching page ${page}...`);
            const response = await fetchRanking(scheduler, appId, genreId, page, affiliateId, accessKey);

            if (page === 1) {
                title = response.title;
                lastBuildDate = response.lastBuildDate;
            }

            if (!response.Items || response.Items.length === 0) {
                break;
            }

            allItems.push(...response.Items);
        } catch (error) {
            console.log(`    Stopped at page ${page}: ${error}`);
            break;
        }
    }

    return { Items: allItems, title, lastBuildDate };
}

async function main() {
    console.log('=== Test User Affiliate Rates ===');
    console.log('Time:', new Date().toISOString());
    if (dryRun) console.log('MODE: dry-run (DB保存なし)');
    if (userIdArg) console.log(`Filter: user=${userIdArg}`);
    if (categoryArg) console.log(`Filter: category=${categoryArg}`);
    console.log('');

    try {
        const pool = getPool();
        const testResult = await pool.query('SELECT NOW() as time');
        console.log('Database connected:', testResult.rows[0].time);

        // Get settings
        const settings = await getSettings();
        if (!settings) {
            console.error('No settings found.');
            return;
        }

        const defaultAppId = settings.rakutenAppId || process.env.RAKUTEN_APP_ID;
        if (!defaultAppId) {
            console.error('RAKUTEN_APP_ID is not set');
            return;
        }

        const categoryIds = categoryArg ? [categoryArg] : (settings.categories || []);
        const topN = settings.topN || 100;

        if (categoryIds.length === 0) {
            console.error('No categories configured');
            return;
        }

        // Get snapshot itemKeys for anchoring
        const snapshotItemKeys = await getLatestSnapshotItemKeys(categoryIds);
        console.log(`Snapshot anchoring: ${snapshotItemKeys.size} unique itemKeys`);

        // Get users
        let users = await getUsersWithAffiliateId();
        if (userIdArg) {
            users = users.filter(u => u.id === userIdArg);
        }

        if (users.length === 0) {
            console.log('No users with affiliate credentials found.');
            return;
        }

        console.log(`\nFound ${users.length} user(s) with credentials:`);
        for (const user of users) {
            console.log(`  - ${user.id} | appId: ${user.rakutenAppId || '(system)'} | accessKey: ${user.rakutenAccessKey ? 'set' : '(system)'} | affiliateId: ${user.rakutenAffiliateId}`);
        }

        // Create scheduler for per-appId rate limiting
        const scheduler = new RequestScheduler(1200);

        // Process all users in parallel - scheduler handles per-appId rate limiting
        const userPromises = users.map(async (user) => {
            const appId = user.rakutenAppId || defaultAppId;
            const accessKey = user.rakutenAccessKey || process.env.RAKUTEN_ACCESS_KEY;

            console.log(`\n--- User: ${user.id} ---`);
            console.log(`  Using appId: ${appId}`);
            console.log(`  Using accessKey: ${accessKey ? 'yes' : 'no'}`);
            console.log(`  AffiliateId: ${user.rakutenAffiliateId}`);

            let totalSaved = 0;
            let totalFiltered = 0;
            let totalErrors = 0;

            for (const catId of categoryIds) {
                try {
                    console.log(`\n  Category: ${catId}`);
                    const response = await fetchAllRankings(scheduler, appId, catId, 4, user.rakutenAffiliateId, accessKey);
                    const items = topN > 0 ? response.Items.slice(0, topN) : response.Items;

                    console.log(`    Fetched ${items.length} items`);

                    if (items.length === 0) {
                        console.warn('    WARNING: 0 items returned - credential issue?');
                        totalErrors++;
                        continue;
                    }

                    // Show sample rates
                    console.log('    Sample rates:');
                    const sampleItems = items.slice(0, 5);
                    for (const itemWrapper of sampleItems) {
                        const item = (itemWrapper as any).Item || itemWrapper;
                        const itemKey = item.itemCode as string;
                        const rate = parseFloat(item.affiliateRate) || 0;
                        const inSnapshot = snapshotItemKeys.size === 0 || snapshotItemKeys.has(itemKey);
                        console.log(`      ${itemKey} -> ${rate}% ${inSnapshot ? '' : '(filtered: not in snapshot)'}`);
                    }

                    // Process rates
                    let saved = 0;
                    let filtered = 0;
                    for (const itemWrapper of items) {
                        const item = (itemWrapper as any).Item || itemWrapper;
                        const itemKey = item.itemCode as string;

                        if (snapshotItemKeys.size > 0 && !snapshotItemKeys.has(itemKey)) {
                            filtered++;
                            continue;
                        }

                        const rate = parseFloat(item.affiliateRate) || 0;

                        if (!dryRun) {
                            await upsertUserAffiliateRate(user.id, itemKey, rate);
                        }
                        saved++;
                    }

                    console.log(`    Result: ${saved} rates ${dryRun ? '(would be saved)' : 'saved'}, ${filtered} filtered`);
                    totalSaved += saved;
                    totalFiltered += filtered;
                } catch (e: any) {
                    console.error(`    ERROR: ${e.message}`);
                    totalErrors++;
                }
            }

            console.log(`\n  Summary for ${user.id}: ${totalSaved} saved, ${totalFiltered} filtered, ${totalErrors} errors`);
        });

        await Promise.allSettled(userPromises);

        console.log('\n=== Test Complete ===');

    } finally {
        await closePool();
    }
}

main().catch(console.error);
