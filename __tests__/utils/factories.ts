import { TaskStatus } from '@prisma/client';

// Factory functions for creating test data

export const createMockSettings = (overrides: Partial<{
  id: string;
  rakutenAppId: string | null;
  categories: string[];
  rankingTypes: string[];
  topN: number;
  ingestEnabled: boolean;
  updatedAt: Date;
}> = {}) => ({
  id: 'settings-1',
  rakutenAppId: 'test-app-id',
  categories: ['100227'],
  rankingTypes: ['realtime'],
  topN: 30,
  ingestEnabled: true,
  updatedAt: new Date(),
  ...overrides,
});

export const createMockSnapshot = (overrides: Partial<{
  id: string;
  capturedAt: Date;
  categoryId: string;
  rankingType: string;
  fetchedCount: number;
  status: string;
  errorMessage: string | null;
}> = {}) => ({
  id: 'snapshot-1',
  capturedAt: new Date(),
  categoryId: '100227',
  rankingType: 'realtime',
  fetchedCount: 30,
  status: 'SUCCESS',
  errorMessage: null,
  ...overrides,
});

export const createMockSnapshotItem = (overrides: Partial<{
  id: string;
  snapshotId: string;
  rank: number;
  itemKey: string;
  title: string;
  itemUrl: string;
  shopName: string;
  apiRate: number | null;
  rawJson: any;
}> = {}) => ({
  id: 'item-1',
  snapshotId: 'snapshot-1',
  rank: 1,
  itemKey: 'test-item-code-1',
  title: 'Test Product',
  itemUrl: 'https://item.rakuten.co.jp/shop/item1/',
  shopName: 'Test Shop',
  apiRate: 5.0,
  rawJson: {},
  ...overrides,
});

export const createMockVerificationTask = (overrides: Partial<{
  id: string;
  itemKey: string;
  latestSnapshotItemId: string | null;
  status: TaskStatus;
  priority: number;
  assigneeId: string | null;
  lastSeenAt: Date;
  dueAt: Date | null;
}> = {}) => ({
  id: 'task-1',
  itemKey: 'test-item-code-1',
  latestSnapshotItemId: 'item-1',
  status: TaskStatus.PENDING,
  priority: 50,
  assigneeId: null,
  lastSeenAt: new Date(),
  dueAt: null,
  ...overrides,
});

export const createMockVerifiedRateCurrent = (overrides: Partial<{
  id: string;
  itemKey: string;
  verifiedRate: number;
  evidenceUrl: string | null;
  note: string | null;
  updatedBy: string;
  updatedAt: Date;
}> = {}) => ({
  id: 'verified-1',
  itemKey: 'test-item-code-1',
  verifiedRate: 5.0,
  evidenceUrl: null,
  note: null,
  updatedBy: 'user-1',
  updatedAt: new Date(),
  ...overrides,
});

export const createMockUser = (overrides: Partial<{
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'OPERATOR' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockAuditLog = (overrides: Partial<{
  id: string;
  actorId: string | null;
  actionType: string;
  entityType: string | null;
  entityId: string | null;
  metaJson: any;
  createdAt: Date;
}> = {}) => ({
  id: 'audit-1',
  actorId: 'user-1',
  actionType: 'VERIFY_RATE',
  entityType: 'VerifiedRate',
  entityId: 'verified-1',
  metaJson: null,
  createdAt: new Date(),
  ...overrides,
});

export const createMockRakutenItem = (rank: number = 1, overrides: Partial<{
  itemCode: string;
  itemName: string;
  itemUrl: string;
  shopName: string;
  affiliateRate: string;
}> = {}) => ({
  rank,
  carrier: 0,
  itemName: `Test Product ${rank}`,
  catchcopy: 'Test catchcopy',
  itemCode: `item-code-${rank}`,
  itemPrice: '1000',
  itemCaption: 'Test caption',
  itemUrl: `https://item.rakuten.co.jp/shop/item${rank}/`,
  affiliateUrl: `https://hb.afl.rakuten.co.jp/item${rank}`,
  imageFlag: 1,
  smallImageUrls: [],
  mediumImageUrls: [],
  availability: 1,
  taxFlag: 0,
  postageFlag: 0,
  creditCardFlag: 1,
  shopOfTheYearFlag: 0,
  shipOverseasFlag: 0,
  shipOverseasArea: '',
  asurakuFlag: 0,
  asurakuClosingTime: '',
  asurakuArea: '',
  affiliateRate: '5.0',
  startTime: '',
  endTime: '',
  reviewCount: 100,
  reviewAverage: '4.5',
  pointRate: 1,
  pointRateStartTime: '',
  pointRateEndTime: '',
  shopName: 'Test Shop',
  shopCode: 'testshop',
  shopUrl: 'https://www.rakuten.co.jp/testshop/',
  genreId: '100227',
  ...overrides,
});

export const createMockRakutenResponse = (itemCount: number = 30) => ({
  Items: Array.from({ length: itemCount }, (_, i) => ({
    Item: createMockRakutenItem(i + 1),
  })),
  title: 'Test Ranking',
  lastBuildDate: new Date().toISOString(),
});
