/**
 * Debug script to inspect Rakuten affiliate page structure
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.rakuten-session.json');

async function main() {
    const testUrl = process.argv[2];

    if (!testUrl) {
        console.log('Usage: npx ts-node scripts/debug-scrape.ts <item-url>');
        console.log('Example: npx ts-node scripts/debug-scrape.ts "https://item.rakuten.co.jp/xxx/yyy/"');
        process.exit(1);
    }

    // Extract shop and item code from URL
    // URL format: https://item.rakuten.co.jp/SHOP_NAME/ITEM_CODE/
    const urlMatch = testUrl.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/\?]+)/);
    if (!urlMatch) {
        console.log('Invalid Rakuten item URL');
        process.exit(1);
    }

    const shopName = urlMatch[1];
    const itemCode = urlMatch[2];
    console.log('Shop:', shopName);
    console.log('Item Code:', itemCode);

    console.log('\nStarting browser...');

    const browser = await chromium.launch({
        headless: false,
    });

    let context;

    // Load saved session
    if (fs.existsSync(SESSION_FILE)) {
        try {
            const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
            context = await browser.newContext({
                storageState: {
                    cookies: sessionData.cookies,
                    origins: []
                }
            });
            console.log('Loaded saved session');
        } catch (e) {
            console.log('Failed to load session');
            context = await browser.newContext();
        }
    } else {
        console.log('No session file found. Please run login-rakuten.ts first.');
        await browser.close();
        process.exit(1);
    }

    const page = await context.newPage();

    // Go to link creator search page
    console.log('\nNavigating to link creator...');
    await page.goto('https://affiliate.rakuten.co.jp/link/ichiba/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'debug-1-linkpage.png', fullPage: true });
    console.log('Screenshot saved: debug-1-linkpage.png');

    // Find search input and search for the item
    console.log('\nSearching for item...');

    // Try to find search input
    const searchInput = await page.$('input[type="text"], input[type="search"], input[name*="keyword"], input[placeholder*="検索"], #keyword');

    if (searchInput) {
        // Search by shop:itemcode format
        const searchQuery = `${shopName} ${itemCode}`;
        console.log('Search query:', searchQuery);

        await searchInput.fill(searchQuery);
        await page.waitForTimeout(500);

        // Find and click search button
        const searchButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("検索")');
        if (searchButton) {
            await searchButton.click();
        } else {
            // Try pressing Enter
            await searchInput.press('Enter');
        }

        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');

        // Take screenshot of search results
        await page.screenshot({ path: 'debug-2-results.png', fullPage: true });
        console.log('Screenshot saved: debug-2-results.png');

        // Save HTML
        const html = await page.content();
        fs.writeFileSync('debug-results.html', html);
        console.log('HTML saved: debug-results.html');

        // Look for rate information in the search results
        console.log('\n--- Searching for rate patterns ---');

        // Look for elements with rate/commission info
        const rateElements = await page.$$eval('*', (elements) => {
            const results: { tag: string; class: string; text: string }[] = [];
            elements.forEach(el => {
                const text = el.textContent || '';
                if ((text.includes('料率') || text.includes('%')) && text.length < 100) {
                    results.push({
                        tag: el.tagName,
                        class: el.className?.toString() || '',
                        text: text.trim()
                    });
                }
            });
            return results.slice(0, 30);
        });

        console.log('\nElements with rate info:');
        rateElements.forEach((el, i) => {
            console.log(`  ${i + 1}. <${el.tag} class="${el.class.slice(0, 50)}"> ${el.text.slice(0, 80)}`);
        });

        // Try to find product cards/items
        const productCards = await page.$$('[class*="product"], [class*="item"], [class*="card"], .search-result-item, li');

        console.log('\nFound', productCards.length, 'potential product elements');

        // Look at first few product cards
        for (let i = 0; i < Math.min(3, productCards.length); i++) {
            const card = productCards[i];
            const cardText = await card.textContent();
            if (cardText && cardText.includes('%')) {
                console.log(`\nProduct ${i + 1}:`, cardText?.slice(0, 200));
            }
        }

    } else {
        console.log('Could not find search input');

        // List all inputs on the page
        const inputs = await page.$$eval('input', (els) => {
            return els.map(el => ({
                type: el.type,
                name: el.name,
                placeholder: el.placeholder,
                id: el.id,
                class: el.className
            }));
        });
        console.log('Inputs on page:', JSON.stringify(inputs, null, 2));
    }

    console.log('\n--- Debug complete ---');
    console.log('Check debug-1-linkpage.png and debug-2-results.png');
    console.log('\nBrowser will stay open. Press Ctrl+C to close.');

    await new Promise(() => {});
}

main().catch(console.error);
