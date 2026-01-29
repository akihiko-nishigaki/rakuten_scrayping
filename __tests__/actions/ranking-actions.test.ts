import { prismaMock } from '../utils/prisma-mock';
import { createMockSnapshot, createMockSnapshotItem, createMockVerifiedRateCurrent } from '../utils/factories';
import {
    getSnapshotListAction,
    getRankingItemsAction,
    getLatestRankingAction,
} from '../../src/app/actions/ranking';

describe('Ranking Actions', () => {
    describe('getSnapshotListAction', () => {
        it('should return list of snapshots with item count', async () => {
            const mockSnapshots = [
                { ...createMockSnapshot({ id: 'snap-1' }), _count: { items: 30 } },
                { ...createMockSnapshot({ id: 'snap-2' }), _count: { items: 25 } },
            ];

            prismaMock.rankingSnapshot.findMany.mockResolvedValue(mockSnapshots as any);

            const result = await getSnapshotListAction();

            expect(result).toHaveLength(2);
            expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith({
                orderBy: { capturedAt: 'desc' },
                take: 50,
                include: {
                    _count: {
                        select: { items: true }
                    }
                }
            });
        });

        it('should return empty array when no snapshots', async () => {
            prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);

            const result = await getSnapshotListAction();

            expect(result).toEqual([]);
        });
    });

    describe('getRankingItemsAction', () => {
        it('should return items with verified rates', async () => {
            const mockItems = [
                createMockSnapshotItem({ id: 'item-1', itemKey: 'key-1', rank: 1 }),
                createMockSnapshotItem({ id: 'item-2', itemKey: 'key-2', rank: 2 }),
            ];

            const mockVerified = [
                createMockVerifiedRateCurrent({ itemKey: 'key-1', verifiedRate: 5.5 }),
            ];

            prismaMock.snapshotItem.findMany.mockResolvedValue(mockItems);
            prismaMock.verifiedRateCurrent.findMany.mockResolvedValue(mockVerified);

            const result = await getRankingItemsAction('snapshot-1');

            expect(result).toHaveLength(2);
            expect(result[0].verifiedRate).not.toBeNull();
            expect(result[1].verifiedRate).toBeNull();
        });

        it('should calculate diff correctly', async () => {
            const mockItems = [
                createMockSnapshotItem({ itemKey: 'key-1', apiRate: 5.0 }),
            ];

            const mockVerified = [
                createMockVerifiedRateCurrent({ itemKey: 'key-1', verifiedRate: 7.0 }),
            ];

            prismaMock.snapshotItem.findMany.mockResolvedValue(mockItems);
            prismaMock.verifiedRateCurrent.findMany.mockResolvedValue(mockVerified);

            const result = await getRankingItemsAction('snapshot-1');

            expect(result[0].diff).toBe(2.0); // 7.0 - 5.0
        });

        it('should return null diff when apiRate is null', async () => {
            const mockItems = [
                createMockSnapshotItem({ itemKey: 'key-1', apiRate: null }),
            ];

            const mockVerified = [
                createMockVerifiedRateCurrent({ itemKey: 'key-1', verifiedRate: 5.0 }),
            ];

            prismaMock.snapshotItem.findMany.mockResolvedValue(mockItems);
            prismaMock.verifiedRateCurrent.findMany.mockResolvedValue(mockVerified);

            const result = await getRankingItemsAction('snapshot-1');

            expect(result[0].diff).toBeNull();
        });
    });

    describe('getLatestRankingAction', () => {
        it('should return latest snapshot with items', async () => {
            const mockSnapshot = createMockSnapshot({ id: 'latest-snap' });
            const mockItems = [createMockSnapshotItem()];

            prismaMock.rankingSnapshot.findFirst.mockResolvedValue(mockSnapshot);
            prismaMock.snapshotItem.findMany.mockResolvedValue(mockItems);
            prismaMock.verifiedRateCurrent.findMany.mockResolvedValue([]);

            const result = await getLatestRankingAction();

            expect(result).not.toBeNull();
            expect(result?.snapshot.id).toBe('latest-snap');
            expect(result?.items).toHaveLength(1);
        });

        it('should return null when no snapshots exist', async () => {
            prismaMock.rankingSnapshot.findFirst.mockResolvedValue(null);

            const result = await getLatestRankingAction();

            expect(result).toBeNull();
        });

        it('should filter by categoryId when provided', async () => {
            prismaMock.rankingSnapshot.findFirst.mockResolvedValue(null);

            await getLatestRankingAction('100227');

            expect(prismaMock.rankingSnapshot.findFirst).toHaveBeenCalledWith({
                where: { status: 'SUCCESS', categoryId: '100227' },
                orderBy: { capturedAt: 'desc' },
            });
        });
    });
});
