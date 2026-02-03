/**
 * VPS Rate Scraper Script
 * Scrapes affiliate rates from Rakuten and saves to Supabase
 * Run with: npm run scrape
 */
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getPool, closePool } from './db';

const SESSION_FILE = path.join(__dirname, '.rakuten-session.json');

interface SessionState {
    cookies: any[];
    localStorage: Record<string, string>;
    lastLogin: string;
}

interface ScrapedRate {
    itemKey: string;
    itemUrl: string;
    actualRate: number | null;
    shopName: string | null;
    scrapedAt: Date;
    error?: string;
}

// Simple ID generator
function generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
}

function loadSession(): SessionState | null {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            const session = JSON.parse(data) as SessionState;

            const lastLogin = new Date(session.lastLogin);
            const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLogin < 7) {
                return session;
            } else {
                console.log('Session expired (older than 7 days)');
                return null;
            }
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
    return null;
}

async function verifySession(page: Page): Promise<boolean> {
    try {
        await page.goto('https://affiliate.rakuten.co.jp/link/ichiba/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.waitForTimeout(2000);

        const pageUrl = page.url();
        console.log('Verify session - current URL:', pageUrl);

        if (pageUrl.includes('grp01.id.rakuten.co.jp') || pageUrl.includes('login')) {
            console.log('Redirected to login page - session invalid');
            return false;
        }

        const searchElements = await page.$$('input, form, .raf-form');
        if (pageUrl.includes('affiliate.rakuten.co.jp') && searchElements.length > 0) {
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error verifying session:', error);
        return false;
    }
}

async function scrapeRate(page: Page, itemUrl: string, itemKey: string, retryCount: number = 0): Promise<ScrapedRate> {
    const result: ScrapedRate = {
        itemKey,
        itemUrl,
        actualRate: null,
        shopName: null,
        scrapedAt: new Date(),
    };

    try {
        // Always construct URL from itemKey to ensure product-level URL
        const keyMatch = itemKey.match(/^([^:]+):(.+)$/);
        if (!keyMatch) {
            result.error = 'Invalid item key format';
            return result;
        }
        const shopName = keyMatch[1];
        const itemCode = keyMatch[2];
        const targetUrl = `https://item.rakuten.co.jp/${shopName}/${itemCode}/`;
        result.shopName = shopName;

        console.log(`  Target URL: ${targetUrl}`);

        // Navigate to affiliate top page with longer timeout
        await page.goto('https://affiliate.rakuten.co.jp/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForTimeout(2000);

        // Find the URL input form
        const urlInput = await page.$('input#u, input[name="u"], input[placeholder*="URL"]');
        if (!urlInput) {
            result.error = 'URL input not found';
            return result;
        }

        // Enter the item URL
        await urlInput.fill(targetUrl);
        await page.waitForTimeout(300);

        // Submit the form
        const submitButton = await page.$('#freelink button[type="submit"], #freelink .btn');
        if (submitButton) {
            await submitButton.click();
        } else {
            await urlInput.press('Enter');
        }

        // Wait for results
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');

        // Find rate
        const rateSelectors = [
            '.raf-head__contentData',
            '[data-test="rate"]',
            '.raf-product__rankBox',
        ];

        for (const selector of rateSelectors) {
            if (result.actualRate !== null) break;

            const elements = await page.$$(selector);

            for (const el of elements) {
                const text = await el.textContent();

                if (text) {
                    const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (rateMatch) {
                        result.actualRate = parseFloat(rateMatch[1]);
                        console.log(`  Found rate: ${result.actualRate}%`);
                        break;
                    }
                }
            }
        }

        // Fallback: search page content
        if (result.actualRate === null) {
            const pageContent = await page.content();
            const patterns = [
                /料率[・:]?\s*報酬.*?(\d+(?:\.\d+)?)\s*%/,
                /"(\d+(?:\.\d+)?)\s*%\s*"/,
            ];
            for (const pattern of patterns) {
                const match = pageContent.match(pattern);
                if (match) {
                    result.actualRate = parseFloat(match[1]);
                    console.log(`  Found in page content: ${result.actualRate}%`);
                    break;
                }
            }
        }

    } catch (error: any) {
        console.error(`  Error scraping rate for ${itemKey}:`, error.message);
        result.error = error.message;

        // Retry once on timeout errors
        if (retryCount === 0 && error.message.includes('Timeout')) {
            console.log(`  Retrying after timeout...`);
            await page.waitForTimeout(3000);
            return scrapeRate(page, itemUrl, itemKey, 1);
        }
    }

    return result;
}

async function saveScrapedRate(scraped: ScrapedRate): Promise<void> {
    if (scraped.actualRate === null) return;

    const pool = getPool();

    // Get or create system user
    let systemUserResult = await pool.query(
        `SELECT id FROM "User" WHERE email = 'system@scraper.local'`
    );

    let systemUserId: string;

    if (systemUserResult.rows.length === 0) {
        systemUserId = generateId();
        await pool.query(
            `INSERT INTO "User" (id, email, password, name, role, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [systemUserId, 'system@scraper.local', 'SYSTEM_USER_NO_LOGIN', 'Rate Scraper', 'USER']
        );
    } else {
        systemUserId = systemUserResult.rows[0].id;
    }

    const note = `Scraped at ${scraped.scrapedAt.toISOString()}`;

    // Upsert verified rate (check if exists first)
    const existingRate = await pool.query(
        `SELECT id FROM "VerifiedRateCurrent" WHERE "itemKey" = $1`,
        [scraped.itemKey]
    );

    if (existingRate.rows.length > 0) {
        // Update existing
        await pool.query(
            `UPDATE "VerifiedRateCurrent"
             SET "verifiedRate" = $1, note = $2, "updatedBy" = $3, "updatedAt" = NOW()
             WHERE "itemKey" = $4`,
            [scraped.actualRate, note, systemUserId, scraped.itemKey]
        );
    } else {
        // Insert new
        await pool.query(
            `INSERT INTO "VerifiedRateCurrent" (id, "itemKey", "verifiedRate", note, "updatedBy", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [generateId(), scraped.itemKey, scraped.actualRate, note, systemUserId]
        );
    }

    // Create history record
    await pool.query(
        `INSERT INTO "VerifiedRateHistory" (id, "itemKey", "verifiedRate", note, "createdBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [generateId(), scraped.itemKey, scraped.actualRate, 'Auto-scraped from affiliate page', systemUserId]
    );
}

async function main() {
    console.log('=== Rakuten Rate Scraper ===');
    console.log('Time:', new Date().toISOString());

    // Check session
    const session = loadSession();
    if (!session) {
        console.error('No valid session found. Please run: npm run login');
        return;
    }

    console.log('Session loaded from:', session.lastLogin);

    const headless = process.env.HEADLESS === 'true';
    console.log('Headless mode:', headless);

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({
        storageState: {
            cookies: session.cookies,
            origins: []
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Verify session
    const isValid = await verifySession(page);
    if (!isValid) {
        console.error('Session expired. Please run: npm run login');
        await browser.close();
        return;
    }

    console.log('Session verified!\n');

    const pool = getPool();

    try {
        // Test connection
        const testResult = await pool.query('SELECT NOW() as time');
        console.log('Database connected:', testResult.rows[0].time);

        // Get items that need scraping from latest snapshot
        // - Only items that haven't been scraped TODAY (daily refresh)
        // - Items from the most recent snapshot for each category
        const itemsResult = await pool.query(`
            WITH LatestSnapshots AS (
                SELECT DISTINCT ON ("categoryId") id, "categoryId", "capturedAt"
                FROM "RankingSnapshot"
                ORDER BY "categoryId", "capturedAt" DESC
            )
            SELECT DISTINCT si."itemKey", si."itemUrl", si."apiRate"
            FROM "SnapshotItem" si
            INNER JOIN LatestSnapshots ls ON si."snapshotId" = ls.id
            LEFT JOIN "VerifiedRateCurrent" vrc ON si."itemKey" = vrc."itemKey"
            WHERE vrc."itemKey" IS NULL
            OR DATE(vrc."updatedAt") < CURRENT_DATE
            ORDER BY si."itemKey"
            LIMIT 50
        `);

        const itemsToScrape = itemsResult.rows;
        console.log(`Found ${itemsToScrape.length} items to scrape\n`);

        let success = 0;
        let failed = 0;

        for (let i = 0; i < itemsToScrape.length; i++) {
            const item = itemsToScrape[i];
            console.log(`[${i + 1}/${itemsToScrape.length}] ${item.itemKey}`);

            const result = await scrapeRate(page, item.itemUrl, item.itemKey);

            if (result.actualRate !== null) {
                await saveScrapedRate(result);
                console.log(`  Saved: ${result.actualRate}%`);
                success++;
            } else if (result.error) {
                console.log(`  Error: ${result.error}`);
                failed++;
            } else {
                console.log(`  Rate not found`);
                failed++;
            }

            // Rate limiting
            if (i < itemsToScrape.length - 1) {
                const delay = 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('\n=== Scrape Complete ===');
        console.log(`Success: ${success}, Failed: ${failed}`);

    } finally {
        await browser.close();
        await closePool();
    }
}

main().catch(console.error);
