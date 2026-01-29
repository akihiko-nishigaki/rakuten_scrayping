/**
 * Test scraping a single item using URL input form
 * Usage: npx ts-node scripts/test-scrape.ts <item-url>
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.rakuten-session.json');

async function main() {
    const testUrl = process.argv[2];

    if (!testUrl) {
        console.log('Usage: npx ts-node scripts/test-scrape.ts <item-url>');
        console.log('Example: npx ts-node scripts/test-scrape.ts "https://item.rakuten.co.jp/yamagoiida/10000077/"');
        process.exit(1);
    }

    console.log('Testing rate scraper...');
    console.log('URL:', testUrl);

    // Load session
    if (!fs.existsSync(SESSION_FILE)) {
        console.log('No session file found. Please run login-rakuten.ts first.');
        process.exit(1);
    }

    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));

    console.log('\nStarting browser...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        storageState: {
            cookies: sessionData.cookies,
            origins: []
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
        // Navigate to affiliate top page
        console.log('Navigating to affiliate page...');
        await page.goto('https://affiliate.rakuten.co.jp/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await page.waitForTimeout(1000);

        // Find the URL input form (freelink form)
        console.log('Looking for URL input...');
        const urlInput = await page.$('input#u, input[name="u"], input[placeholder*="URL"]');

        if (!urlInput) {
            console.log('URL input not found');
            await page.screenshot({ path: 'debug-no-input.png', fullPage: true });
            await browser.close();
            process.exit(1);
        }

        // Enter the item URL
        console.log('Entering URL:', testUrl);
        await urlInput.fill(testUrl);
        await page.waitForTimeout(300);

        // Submit the form
        const submitButton = await page.$('#freelink button[type="submit"], #freelink .btn');
        if (submitButton) {
            console.log('Clicking submit button...');
            await submitButton.click();
        } else {
            console.log('Pressing Enter...');
            await urlInput.press('Enter');
        }

        // Wait for results page
        console.log('Waiting for results...');
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');

        console.log('Current URL:', page.url());

        // Take screenshot
        await page.screenshot({ path: 'test-scrape-result.png', fullPage: true });
        console.log('Screenshot saved: test-scrape-result.png');

        // Find rate
        console.log('\nLooking for rate...');

        // Try multiple selectors - prioritize the freelink result page selectors
        const rateSelectors = [
            '.raf-head__contentData',
            '[data-test="rate"]',
            '.raf-product__rankBox',
        ];

        let actualRate: number | null = null;

        for (const selector of rateSelectors) {
            const elements = await page.$$(selector);
            console.log(`Selector "${selector}": found ${elements.length} elements`);

            for (const el of elements) {
                const text = await el.textContent();
                console.log(`  Text: "${text?.trim()}"`);

                if (text) {
                    const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (rateMatch) {
                        actualRate = parseFloat(rateMatch[1]);
                        console.log(`  -> Found rate: ${actualRate}%`);
                        break;
                    }
                }
            }
            if (actualRate !== null) break;
        }

        // Fallback: search page content
        if (actualRate === null) {
            console.log('Trying fallback: searching page content...');
            const pageContent = await page.content();
            const patterns = [
                /料率[・:]?\s*報酬.*?(\d+(?:\.\d+)?)\s*%/,
                /"(\d+(?:\.\d+)?)\s*%\s*"/,
            ];
            for (const pattern of patterns) {
                const match = pageContent.match(pattern);
                if (match) {
                    actualRate = parseFloat(match[1]);
                    console.log(`Found in page content: ${match[0]}`);
                    break;
                }
            }
        }

        console.log('\n========================================');
        console.log('Result:');
        console.log('  URL:', testUrl);
        console.log('  Rate:', actualRate !== null ? `${actualRate}%` : 'Not found');
        console.log('========================================');

        if (actualRate !== null) {
            console.log('\n SUCCESS! Rate found:', actualRate + '%');
        } else {
            console.log('\n Rate not found - check test-scrape-result.png');
        }

    } catch (error: any) {
        console.error('Error:', error.message);
        await page.screenshot({ path: 'test-scrape-error.png', fullPage: true });
    } finally {
        console.log('\nBrowser will stay open. Press Ctrl+C to close.');
        await new Promise(() => {});
    }
}

main().catch(console.error);
