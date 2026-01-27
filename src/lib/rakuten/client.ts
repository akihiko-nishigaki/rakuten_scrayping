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
     * @param page Page number (optional)
     */
    async getRanking(genreId: string = "0", period: string = "realtime"): Promise<RakutenRankingResponse> {
        const params = new URLSearchParams({
            applicationId: this.appId,
            formatVersion: "2",
            genreId: genreId,
            period: period, // realtime, etc depending on API spec. Note: 20220601 ver might not support period param in same way, checking docs recommended. 
            // Actually standard API 2.0 Ranking usually just takes genreId.
        });

        if (this.affiliateId) {
            params.append("affiliateId", this.affiliateId);
        }

        const res = await fetch(`${RAKUTEN_API_ENDPOINT}?${params.toString()}`);

        if (!res.ok) {
            throw new Error(`Rakuten API Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // API returns error in body sometimes even with 200 checks, but standard Rakuten error is 4xx usually.
        if (data.error) {
            throw new Error(`Rakuten API Error Body: ${data.error} - ${data.error_description}`);
        }

        return data as RakutenRankingResponse;
    }
}
