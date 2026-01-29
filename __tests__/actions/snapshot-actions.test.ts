import { prismaMock } from '../utils/prisma-mock';
import { createMockSnapshot, createMockSnapshotItem } from '../utils/factories';
import {
    getSnapshotsAction,
    getSnapshotDetailAction,
    getSnapshotStatsAction,
} from '../../src/app/actions/snapshot';

describe('Snapshot Actions', () => {
    describe('getSnapshotsAction', () => {
        it('should return paginated snapshots', async () => {
            const mockSnapshots = [
                { ...createMockSnapshot({ id: 'snap-1' }), _count: { items: 30 } },
            ];

            prismaMock.rankingSnapshot.findMany.mockResolvedValue(mockSnapshots as any);
            prismaMock.rankingSnapshot.count.mockResolvedValue(1);

            const result = await getSnapshotsAction({ limit: 20, offset: 0 });

            expect(result.snapshots).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.hasMore).toBe(false);
        });

        it('should filter by categoryId', async () => {
            prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
            prismaMock.rankingSnapshot.count.mockResolvedValue(0);

            await getSnapshotsAction({ categoryId: '100227' });

            expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { categoryId: '100227' },
                })
            );
        });

        it('should indicate hasMore when more results exist', async () => {
            const mockSnapshots = Array(20).fill(null).map((_, i) => ({
                ...createMockSnapshot({ id: `snap-${i}` }),
                _count: { items: 30 },
            }));

            prismaMock.rankingSnapshot.findMany.mockResolvedValue(mockSnapshots as any);
            prismaMock.rankingSnapshot.count.mockResolvedValue(50);

            const result = await getSnapshotsAction({ limit: 20, offset: 0 });

            expect(result.hasMore).toBe(true);
        });
    });

    describe('getSnapshotDetailAction', () => {
        it('should return snapshot with items and verified rates', async () => {
            const mockSnapshot = {
                ...createMockSnapshot({ id: 'snap-1' }),
                items: [
                    createMockSnapshotItem({ itemKey: 'key-1', apiRate: 5.0 }),
                ],
            };

            prismaMock.rankingSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
            prismaMock.verifiedRateCurrent.findMany.mockResolvedValue([]);

            const result = await getSnapshotDetailAction('snap-1');

            expect(result).not.toBeNull();
            expect(result?.items).toHaveLength(1);
        });

        it('should return null for non-existent snapshot', async () => {
            prismaMock.rankingSnapshot.findUnique.mockResolvedValue(null);

            const result = await getSnapshotDetailAction('non-existent');

            expect(result).toBeNull();
        });

        it('should calculate diff for items with verified rates', async () => {
            const mockSnapshot = {
                ...createMockSnapshot({ id: 'snap-1' }),
                items: [
                    createMockSnapshotItem({ itemKey: 'key-1', apiRate: 5.0 }),
                ],
            };

            const mockVerified = [
                { itemKey: 'key-1', verifiedRate: 7.5 },
            ];

            prismaMock.rankingSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
            prismaMock.verifiedRateCurrent.findMany.mockResolvedValue(mockVerified as any);

            const result = await getSnapshotDetailAction('snap-1');

            expect(result?.items[0].verifiedRate).toBe(7.5);
            expect(result?.items[0].diff).toBe(2.5);
        });
    });

    describe('getSnapshotStatsAction', () => {
        it('should return aggregated stats', async () => {
            prismaMock.rankingSnapshot.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(95)  // success
                .mockResolvedValueOnce(5);  // error

            prismaMock.rankingSnapshot.findFirst.mockResolvedValue(
                createMockSnapshot({ capturedAt: new Date('2024-01-15') })
            );

            prismaMock.rankingSnapshot.groupBy.mockResolvedValue([
                { categoryId: '100227', _count: { id: 50 } },
                { categoryId: '200162', _count: { id: 50 } },
            ] as any);

            const result = await getSnapshotStatsAction();

            expect(result.total).toBe(100);
            expect(result.successCount).toBe(95);
            expect(result.errorCount).toBe(5);
            expect(result.categoryBreakdown).toHaveLength(2);
        });

        it('should handle no snapshots', async () => {
            prismaMock.rankingSnapshot.count.mockResolvedValue(0);
            prismaMock.rankingSnapshot.findFirst.mockResolvedValue(null);
            prismaMock.rankingSnapshot.groupBy.mockResolvedValue([]);

            const result = await getSnapshotStatsAction();

            expect(result.total).toBe(0);
            expect(result.latestCapturedAt).toBeNull();
            expect(result.categoryBreakdown).toEqual([]);
        });
    });
});
