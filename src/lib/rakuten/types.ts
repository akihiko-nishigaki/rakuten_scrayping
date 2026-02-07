export interface RakutenRankingItem {
  rank: number;
  carrier: number;
  itemName: string;
  catchcopy: string;
  itemCode: string;
  itemPrice: number;
  itemCaption: string;
  itemUrl: string;
  affiliateUrl: string;
  imageFlag: number;
  smallImageUrls: string[];
  mediumImageUrls: string[];
  availability: number;
  taxFlag: number;
  postageFlag: number;
  creditCardFlag: number;
  shopOfTheYearFlag: number;
  shipOverseasFlag: number;
  shipOverseasArea: string;
  asurakuFlag: number;
  asurakuClosingTime: string;
  asurakuArea: string;
  affiliateRate: string; // "3.0" etc. This is the API rate.
  startTime: string;
  endTime: string;
  reviewCount: number;
  reviewAverage: string;
  pointRate: number;
  pointRateStartTime: string;
  pointRateEndTime: string;
  shopName: string;
  shopCode: string;
  shopUrl: string;
  genreId: string;
}

// formatVersion: "2" returns items directly (not wrapped in {Item: ...})
export interface RakutenRankingResponse {
  Items: RakutenRankingItem[];
  title: string;
  lastBuildDate: string;
}

export interface RankingClientOptions {
  appId: string;
  affiliateId?: string;
  formatVersion?: number;
}
