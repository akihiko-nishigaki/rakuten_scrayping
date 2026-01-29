import { RakutenSessionManager } from './sessionManager';

export interface ScrapedRate {
    itemKey: string;
    itemUrl: string;
    actualRate: number | null;
    shopName: string | null;
    scrapedAt: Date;
    error?: string;
}

export class RateScraper {
    private sessionManager: RakutenSessionManager;
    private isInitialized = false;

    constructor() {
        this.sessionManager = new RakutenSessionManager();
    }

    /**
     * Initialize scraper with session
     */
    async init(): Promise<boolean> {
        if (this.isInitialized) return true;

        const success = await this.sessionManager.init();
        this.isInitialized = success;
        return success;
    }


    /**
     * Scrape rate for a single item
     */
    async scrapeRate(itemUrl: string, itemKey: string): Promise<ScrapedRate> {
        if (!this.isInitialized) {
            throw new Error('Scraper not initialized. Call init() first.');
        }

        const page = this.sessionManager.getPage();
        const result: ScrapedRate = {
            itemKey,
            itemUrl,
            actualRate: null,
            shopName: null,
            scrapedAt: new Date(),
        };

        try {
            let targetUrl: string;

            // Use itemUrl from DB if it's a direct rakuten item URL
            if (itemUrl && itemUrl.includes('item.rakuten.co.jp')) {
                targetUrl = itemUrl;
                // Extract shop name from URL
                const shopMatch = itemUrl.match(/item\.rakuten\.co\.jp\/([^\/]+)/);
                result.shopName = shopMatch ? shopMatch[1] : null;
            } else {
                // Fallback: build URL from itemKey (format: shopName:itemCode)
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

            console.log(`Target URL: ${targetUrl}`);

            // Navigate to affiliate top page
            await page.goto('https://affiliate.rakuten.co.jp/', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            await page.waitForTimeout(1000);

            // Find the URL input form (freelink form)
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

            // Wait for results page
            await page.waitForTimeout(3000);
            await page.waitForLoadState('networkidle');

            // Find rate on the freelink result page
            // Primary selector: .raf-head__contentData contains "4.0%"
            const rateSelectors = [
                '.raf-head__contentData',
                '[data-test="rate"]',
                '.raf-product__rankBox',
            ];

            for (const selector of rateSelectors) {
                if (result.actualRate !== null) break;

                const elements = await page.$$(selector);
                console.log(`Selector "${selector}": found ${elements.length} elements`);

                for (const el of elements) {
                    const text = await el.textContent();
                    console.log(`  Text: "${text?.trim()}"`);

                    if (text) {
                        const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                        if (rateMatch) {
                            result.actualRate = parseFloat(rateMatch[1]);
                            console.log(`  -> Found rate: ${result.actualRate}%`);
                            break;
                        }
                    }
                }
            }

            // Fallback: search page content
            if (result.actualRate === null) {
                console.log('Trying fallback: searching page content...');
                const pageContent = await page.content();
                const patterns = [
                    /料率[・:]?\s*報酬.*?(\d+(?:\.\d+)?)\s*%/,
                    /"(\d+(?:\.\d+)?)\s*%\s*"/,
                ];
                for (const pattern of patterns) {
                    const match = pageContent.match(pattern);
                    if (match) {
                        result.actualRate = parseFloat(match[1]);
                        console.log(`Found in page content: ${match[0]} -> ${result.actualRate}%`);
                        break;
                    }
                }
            }

        } catch (error: any) {
            console.error(`Error scraping rate for ${itemKey}:`, error.message);
            result.error = error.message;
        }

        return result;
    }

    /**
     * Scrape rates for multiple items with rate limiting
     */
    async scrapeRates(items: { itemUrl: string; itemKey: string }[]): Promise<ScrapedRate[]> {
        const results: ScrapedRate[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`Scraping ${i + 1}/${items.length}: ${item.itemKey}`);

            const result = await this.scrapeRate(item.itemUrl, item.itemKey);
            results.push(result);

            // Log result
            if (result.actualRate !== null) {
                console.log(`  -> Rate: ${result.actualRate}%`);
            } else if (result.error) {
                console.log(`  -> Error: ${result.error}`);
            } else {
                console.log(`  -> Rate not found`);
            }

            // Rate limiting - wait 1-2 seconds between requests
            if (i < items.length - 1) {
                const delay = 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }

    /**
     * Close the browser
     */
    async close(): Promise<void> {
        await this.sessionManager.close();
        this.isInitialized = false;
    }
}

// Singleton instance for reuse
let scraperInstance: RateScraper | null = null;

export async function getScraperInstance(): Promise<RateScraper> {
    if (!scraperInstance) {
        scraperInstance = new RateScraper();
    }
    return scraperInstance;
}

export async function closeScraperInstance(): Promise<void> {
    if (scraperInstance) {
        await scraperInstance.close();
        scraperInstance = null;
    }
}
