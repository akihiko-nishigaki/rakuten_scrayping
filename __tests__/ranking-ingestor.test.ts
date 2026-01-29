import { prismaMock } from './utils/prisma-mock';
import {
  createMockSettings,
  createMockSnapshot,
  createMockSnapshotItem,
  createMockRakutenResponse,
  createMockVerifiedRateCurrent,
  createMockVerificationTask,
} from './utils/factories';
import { RankingIngestor } from '../src/lib/ingestor/rankingIngestor';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('RankingIngestor', () => {
  let ingestor: RankingIngestor;

  beforeEach(() => {
    ingestor = new RankingIngestor('test-app-id', 'test-affiliate-id');
    mockFetch.mockReset();
  });

  describe('ingestCategory', () => {
    it('should create snapshot and items for a category', async () => {
      const mockResponse = createMockRakutenResponse(10);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const mockSnapshot = createMockSnapshot({ id: 'snapshot-123' });
      prismaMock.rankingSnapshot.create.mockResolvedValue(mockSnapshot);

      const mockSnapshotItem = createMockSnapshotItem();
      prismaMock.snapshotItem.create.mockResolvedValue(mockSnapshotItem);

      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      const result = await ingestor.ingestCategory('100227', 10);

      expect(result.count).toBe(10);
      expect(result.snapshotId).toBe('snapshot-123');
      expect(prismaMock.rankingSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          categoryId: '100227',
          rankingType: 'realtime',
          fetchedCount: 10,
          status: 'SUCCESS',
        }),
      });
    });

    it('should limit items to topN', async () => {
      const mockResponse = createMockRakutenResponse(100);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      const result = await ingestor.ingestCategory('100227', 30);

      expect(result.count).toBe(30);
      expect(prismaMock.snapshotItem.create).toHaveBeenCalledTimes(30);
    });

    it('should check for existing verified rate for each item', async () => {
      const mockResponse = createMockRakutenResponse(5);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      await ingestor.ingestCategory('100227', 5);

      expect(prismaMock.verifiedRateCurrent.findUnique).toHaveBeenCalledTimes(5);
    });

    it('should use verified rate when creating task', async () => {
      const mockResponse = createMockRakutenResponse(1);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const verifiedRate = createMockVerifiedRateCurrent({
        itemKey: 'item-code-1',
        verifiedRate: 3.5,
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(verifiedRate);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      await ingestor.ingestCategory('100227', 1);

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalled();
    });

    it('should create snapshot item with correct data', async () => {
      const mockResponse = createMockRakutenResponse(1);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot({ id: 'snap-1' }));
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      await ingestor.ingestCategory('100227', 1);

      expect(prismaMock.snapshotItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshotId: 'snap-1',
          rank: 1,
          itemKey: 'item-code-1',
          title: 'Test Product 1',
          apiRate: 5.0,
        }),
      });
    });
  });

  describe('ingestAllConfiguredCategories', () => {
    it('should use settings from database', async () => {
      const mockSettings = createMockSettings({
        categories: ['100227', '200162'],
        topN: 20,
      });

      prismaMock.settings.findFirst.mockResolvedValue(mockSettings);

      const mockResponse = createMockRakutenResponse(20);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      const results = await ingestor.ingestAllConfiguredCategories();

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe('100227');
      expect(results[1].categoryId).toBe('200162');
    });

    it('should use default categories when settings not found', async () => {
      prismaMock.settings.findFirst.mockResolvedValue(null);

      const mockResponse = createMockRakutenResponse(30);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      const results = await ingestor.ingestAllConfiguredCategories();

      // Default categories: ["100227", "200162"]
      expect(results).toHaveLength(2);
    });

    it('should handle errors for individual categories', async () => {
      const mockSettings = createMockSettings({
        categories: ['100227', 'invalid-category'],
        topN: 10,
      });

      prismaMock.settings.findFirst.mockResolvedValue(mockSettings);

      // First category succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockRakutenResponse(10),
      });

      // Second category fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const results = await ingestor.ingestAllConfiguredCategories();

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('SUCCESS');
      expect(results[1].status).toBe('ERROR');
      expect(results[1].error).toContain('400');

      consoleSpy.mockRestore();
    });

    it('should return success count for each category', async () => {
      const mockSettings = createMockSettings({
        categories: ['100227'],
        topN: 15,
      });

      prismaMock.settings.findFirst.mockResolvedValue(mockSettings);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockRakutenResponse(15),
      });

      prismaMock.rankingSnapshot.create.mockResolvedValue(createMockSnapshot());
      prismaMock.snapshotItem.create.mockResolvedValue(createMockSnapshotItem());
      prismaMock.verifiedRateCurrent.findUnique.mockResolvedValue(null);
      prismaMock.verificationTask.upsert.mockResolvedValue(createMockVerificationTask());

      const results = await ingestor.ingestAllConfiguredCategories();

      expect(results[0]).toEqual({
        categoryId: '100227',
        status: 'SUCCESS',
        count: 15,
      });
    });
  });
});
