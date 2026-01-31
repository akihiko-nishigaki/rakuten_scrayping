/**
 * VPS Rate Scraper Script
 * Scrapes affiliate rates from Rakuten and saves to Supabase
 * Run with: npm run scrape
 */
import 'dotenv/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getPrisma, closePrisma } from './db';

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

async function scrapeRate(page: Page, itemUrl: string, itemKey: string): Promise<ScrapedRate> {
    const result: ScrapedRate = {
        itemKey,
        itemUrl,
        actualRate: null,
        shopName: null,
        scrapedAt: new Date(),
    };

    try {
        let targetUrl: string;

        if (itemUrl && itemUrl.includes('item.rakuten.co.jp')) {
            targetUrl = itemUrl;
            const shopMatch = itemUrl.match(/item\.rakuten\.co\.jp\/([^\/]+)/);
            result.shopName = shopMatch ? shopMatch[1] : null;
        } else {
            const keyMatch = itemKey.match(/^([^:]+):(.+)$/);
            if (!keyMatch) {
                result.error = 'Invalid item key format';
                return result;
            }
            const shopName = keyMatch[1];
            const itemCode = keyMatch[2];
            targetUrl = `https://item.rakuten.co.jp/${shopName}/${itemCode}/`;
            result.shopName = shopName;
        }

        console.log(`  Target URL: ${targetUrl}`);

        // Navigate to affiliate top page
        await page.goto('https://affiliate.rakuten.co.jp/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await page.waitForTimeout(1000);

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
    }

    return result;
}

async function saveScrapedRate(prisma: any, scraped: ScrapedRate): Promise<void> {
    if (scraped.actualRate === null) return;

    // Get or create system user
    let systemUser = await prisma.user.findFirst({
        where: { email: 'system@scraper.local' }
    });

    if (!systemUser) {
        systemUser = await prisma.user.create({
            data: {
                email: 'system@scraper.local',
                password: 'SYSTEM_USER_NO_LOGIN',
                name: 'Rate Scraper',
                role: 'USER'
            }
        });
    }

    // Upsert verified rate
    await prisma.verifiedRateCurrent.upsert({
        where: { itemKey: scraped.itemKey },
        update: {
            verifiedRate: scraped.actualRate,
            note: `Scraped at ${scraped.scrapedAt.toISOString()}`,
            updatedBy: systemUser.id
        },
        create: {
            itemKey: scraped.itemKey,
            verifiedRate: scraped.actualRate,
            note: `Scraped at ${scraped.scrapedAt.toISOString()}`,
            updatedBy: systemUser.id
        }
    });

    // Create history record
    await prisma.verifiedRateHistory.create({
        data: {
            itemKey: scraped.itemKey,
            verifiedRate: scraped.actualRate,
            note: `Auto-scraped from affiliate page`,
            createdBy: systemUser.id
        }
    });
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

    const prisma = getPrisma();

    try {
        // Get items that need scraping (latest snapshot items without verified rates)
        const itemsToScrape = await prisma.$queryRaw`
            SELECT DISTINCT si."itemKey", si."itemUrl", si."apiRate"
            FROM "SnapshotItem" si
            LEFT JOIN "VerifiedRateCurrent" vrc ON si."itemKey" = vrc."itemKey"
            WHERE vrc."itemKey" IS NULL
            OR vrc."updatedAt" < NOW() - INTERVAL '7 days'
            ORDER BY si."itemKey"
            LIMIT 50
        `;

        console.log(`Found ${(itemsToScrape as any[]).length} items to scrape\n`);

        let success = 0;
        let failed = 0;

        for (let i = 0; i < (itemsToScrape as any[]).length; i++) {
            const item = (itemsToScrape as any[])[i];
            console.log(`[${i + 1}/${(itemsToScrape as any[]).length}] ${item.itemKey}`);

            const result = await scrapeRate(page, item.itemUrl, item.itemKey);

            if (result.actualRate !== null) {
                await saveScrapedRate(prisma, result);
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
            if (i < (itemsToScrape as any[]).length - 1) {
                const delay = 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('\n=== Scrape Complete ===');
        console.log(`Success: ${success}, Failed: ${failed}`);

    } finally {
        await browser.close();
        await closePrisma();
    }
}

main().catch(console.error);
