import { prisma } from '@/lib/prisma';
import { RateScraper, ScrapedRate, getScraperInstance, closeScraperInstance } from './rateScraper';

export interface ScrapeJobResult {
    total: number;
    success: number;
    failed: number;
    results: {
        itemKey: string;
        apiRate: number | null;
        scrapedRate: number | null;
        difference: number | null;
        status: 'success' | 'failed' | 'no_rate';
        error?: string;
    }[];
}

export class RateScraperService {
    /**
     * Scrape rates for items in a specific snapshot
     */
    static async scrapeSnapshotItems(snapshotId: string): Promise<ScrapeJobResult> {
        const items = await prisma.snapshotItem.findMany({
            where: { snapshotId },
            select: {
                itemKey: true,
                itemUrl: true,
                apiRate: true,
            }
        });

        return this.scrapeItems(items);
    }

    /**
     * Scrape rates for pending verification tasks
     */
    static async scrapePendingTasks(limit: number = 50): Promise<ScrapeJobResult> {
        const tasks = await prisma.verificationTask.findMany({
            where: { status: 'PENDING' },
            take: limit,
            orderBy: { priority: 'desc' },
            select: { itemKey: true }
        });

        // Get item details from latest snapshot items
        const itemKeys = tasks.map(t => t.itemKey);
        const items = await prisma.snapshotItem.findMany({
            where: { itemKey: { in: itemKeys } },
            orderBy: { snapshot: { capturedAt: 'desc' } },
            distinct: ['itemKey'],
            select: {
                itemKey: true,
                itemUrl: true,
                apiRate: true,
            }
        });

        return this.scrapeItems(items);
    }

    /**
     * Scrape rates for specific item keys
     */
    static async scrapeByItemKeys(itemKeys: string[]): Promise<ScrapeJobResult> {
        const items = await prisma.snapshotItem.findMany({
            where: { itemKey: { in: itemKeys } },
            orderBy: { snapshot: { capturedAt: 'desc' } },
            distinct: ['itemKey'],
            select: {
                itemKey: true,
                itemUrl: true,
                apiRate: true,
            }
        });

        return this.scrapeItems(items);
    }

    /**
     * Core scraping logic
     */
    private static async scrapeItems(
        items: { itemKey: string; itemUrl: string; apiRate: number | null }[]
    ): Promise<ScrapeJobResult> {
        const result: ScrapeJobResult = {
            total: items.length,
            success: 0,
            failed: 0,
            results: []
        };

        if (items.length === 0) {
            return result;
        }

        const scraper = await getScraperInstance();

        try {
            const initialized = await scraper.init();
            if (!initialized) {
                throw new Error('Failed to initialize scraper (login required)');
            }

            const scrapedRates = await scraper.scrapeRates(
                items.map(i => ({ itemUrl: i.itemUrl, itemKey: i.itemKey }))
            );

            // Process results and update database
            for (const scraped of scrapedRates) {
                const originalItem = items.find(i => i.itemKey === scraped.itemKey);
                const apiRate = originalItem?.apiRate ?? null;

                if (scraped.actualRate !== null) {
                    // Save to VerifiedRateCurrent (upsert)
                    await this.saveScrapedRate(scraped);

                    result.success++;
                    result.results.push({
                        itemKey: scraped.itemKey,
                        apiRate,
                        scrapedRate: scraped.actualRate,
                        difference: apiRate !== null ? scraped.actualRate - apiRate : null,
                        status: 'success'
                    });
                } else if (scraped.error) {
                    result.failed++;
                    result.results.push({
                        itemKey: scraped.itemKey,
                        apiRate,
                        scrapedRate: null,
                        difference: null,
                        status: 'failed',
                        error: scraped.error
                    });
                } else {
                    result.results.push({
                        itemKey: scraped.itemKey,
                        apiRate,
                        scrapedRate: null,
                        difference: null,
                        status: 'no_rate'
                    });
                }
            }
        } finally {
            // Don't close the browser - keep session for reuse
            // await closeScraperInstance();
        }

        return result;
    }

    /**
     * Save scraped rate to database
     */
    private static async saveScrapedRate(scraped: ScrapedRate): Promise<void> {
        if (scraped.actualRate === null) return;

        // Get or create a system user for automated scraping
        let systemUser = await prisma.user.findFirst({
            where: { email: 'system@scraper.local' }
        });

        if (!systemUser) {
            systemUser = await prisma.user.create({
                data: {
                    email: 'system@scraper.local',
                    password: 'SYSTEM_USER_NO_LOGIN', // System user cannot login
                    name: 'Rate Scraper',
                    role: 'USER'
                }
            });
        }

        // Upsert the verified rate
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

        // Also create history record
        await prisma.verifiedRateHistory.create({
            data: {
                itemKey: scraped.itemKey,
                verifiedRate: scraped.actualRate,
                note: `Auto-scraped from affiliate page`,
                createdBy: systemUser.id
            }
        });

        // Update verification task status
        await prisma.verificationTask.updateMany({
            where: { itemKey: scraped.itemKey },
            data: { status: 'VERIFIED' }
        });
    }

    /**
     * Close the scraper and save session
     */
    static async closeScraper(): Promise<void> {
        await closeScraperInstance();
    }
}
