import { RakutenRankingResponse } from './types';

const RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601";

export class RakutenClient {
    private appId: string;
    private affiliateId?: string;

    constructor(appId: string, affiliateId?: string) {
        this.appId = appId;
        this.affiliateId = affiliateId;
    }

    /**
     * Fetch ranking items for a specific genre (category).
     * @param genreId Target genre ID (default to "0" for all)
     * @param page Page number (1-4, each page has up to 30 items)
     */
    async getRanking(genreId: string = "0", page: number = 1): Promise<RakutenRankingResponse> {
        const params = new URLSearchParams({
            applicationId: this.appId,
            formatVersion: "2",
            genreId: genreId,
            page: String(page),
            period: "realtime",
        });

        if (this.affiliateId) {
            params.append("affiliateId", this.affiliateId);
        }

        const res = await fetch(`${RAKUTEN_API_ENDPOINT}?${params.toString()}`, {
            headers: {
                'Referer': 'https://rakuten-scrayping.vercel.app/',
            },
        });

        if (!res.ok) {
            throw new Error(`Rakuten API Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (data.error) {
            throw new Error(`Rakuten API Error Body: ${data.error} - ${data.error_description}`);
        }

        return data as RakutenRankingResponse;
    }

    /**
     * Fetch all available ranking items (multiple pages)
     * @param genreId Target genre ID
     * @param maxPages Maximum pages to fetch (default 4 = 120 items max)
     */
    async getAllRankings(genreId: string = "0", maxPages: number = 4): Promise<RakutenRankingResponse> {
        const allItems: any[] = [];
        let title = '';
        let lastBuildDate = '';

        for (let page = 1; page <= maxPages; page++) {
            try {
                const response = await this.getRanking(genreId, page);

                if (page === 1) {
                    title = response.title;
                    lastBuildDate = response.lastBuildDate;
                }

                if (!response.Items || response.Items.length === 0) {
                    break; // No more items
                }

                allItems.push(...response.Items);

                // If less than 30 items, we've reached the end
                // Don't stop early - some categories return fewer items per page
                // Continue fetching all pages to get complete ranking

                // Rate limiting - wait 200ms between requests
                if (page < maxPages) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                // If page doesn't exist, stop
                console.log(`Stopped at page ${page}: ${error}`);
                break;
            }
        }

        return {
            Items: allItems,
            title,
            lastBuildDate,
        };
    }
}
