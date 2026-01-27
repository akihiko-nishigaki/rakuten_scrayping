export interface RakutenRankingItem {
  rank: number;
  carrier: number;
  itemName: string;
  catchcopy: string;
  itemCode: string;
  itemPrice: string;
  itemCaption: string;
  itemUrl: string;
  affiliateUrl: string;
  imageFlag: number;
  smallImageUrls: { imageUrl: string }[];
  mediumImageUrls: { imageUrl: string }[];
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

export interface RakutenRankingResponse {
  Items: { Item: RakutenRankingItem }[];
  title: string;
  lastBuildDate: string;
}

export interface RankingClientOptions {
  appId: string;
  affiliateId?: string;
  formatVersion?: number;
}
