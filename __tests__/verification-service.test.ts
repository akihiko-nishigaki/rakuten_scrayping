import { prismaMock } from './utils/prisma-mock';
import { createMockVerificationTask } from './utils/factories';
import { VerificationService } from '../src/lib/verification/service';
import { TaskStatus } from '@prisma/client';

describe('VerificationService', () => {
  describe('upsertTaskFromIngest', () => {
    it('should create new PENDING task for new item', async () => {
      const mockTask = createMockVerificationTask({
        status: TaskStatus.PENDING,
        priority: 50,
      });

      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      await VerificationService.upsertTaskFromIngest(
        'new-item-key',
        'snapshot-item-1',
        1,    // rank
        5.0,  // apiRate
        null, // no verified rate (new item)
        undefined
      );

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { itemKey: 'new-item-key' },
          create: expect.objectContaining({
            itemKey: 'new-item-key',
            status: TaskStatus.PENDING,
            priority: 50,
          }),
        })
      );
    });

    it('should set VERIFIED status when item has verified rate', async () => {
      const mockTask = createMockVerificationTask({
        status: TaskStatus.VERIFIED,
      });

      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      await VerificationService.upsertTaskFromIngest(
        'verified-item',
        'snapshot-item-1',
        1,
        5.0,  // apiRate
        5.0,  // verifiedRate matches
        new Date()
      );

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: TaskStatus.VERIFIED,
          }),
        })
      );
    });

    it('should reopen task to PENDING when diff >= 1.0', async () => {
      const mockTask = createMockVerificationTask({
        status: TaskStatus.PENDING,
      });

      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      await VerificationService.upsertTaskFromIngest(
        'diff-item',
        'snapshot-item-1',
        1,
        7.0,  // apiRate
        5.0,  // verifiedRate - diff is 2.0
        new Date()
      );

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: TaskStatus.PENDING,
          }),
        })
      );
    });

    it('should not reopen task when diff < 1.0', async () => {
      const mockTask = createMockVerificationTask({
        status: TaskStatus.VERIFIED,
      });

      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      await VerificationService.upsertTaskFromIngest(
        'small-diff-item',
        'snapshot-item-1',
        1,
        5.5,  // apiRate
        5.0,  // verifiedRate - diff is 0.5
        new Date()
      );

      // Update should NOT include status change
      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.not.objectContaining({
            status: TaskStatus.PENDING,
          }),
        })
      );
    });

    it('should update priority based on rank', async () => {
      const mockTask = createMockVerificationTask();
      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      // Test Top 3 priority
      await VerificationService.upsertTaskFromIngest(
        'top3-item',
        'snapshot-1',
        2,
        null,
        null
      );

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            priority: 50,
          }),
        })
      );
    });

    it('should update lastSeenAt timestamp', async () => {
      const mockTask = createMockVerificationTask();
      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      const beforeCall = new Date();

      await VerificationService.upsertTaskFromIngest(
        'timestamp-item',
        'snapshot-1',
        1,
        null,
        null
      );

      const afterCall = new Date();

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            lastSeenAt: expect.any(Date),
          }),
          update: expect.objectContaining({
            lastSeenAt: expect.any(Date),
          }),
        })
      );
    });

    it('should update latestSnapshotItemId', async () => {
      const mockTask = createMockVerificationTask();
      prismaMock.verificationTask.upsert.mockResolvedValue(mockTask);

      await VerificationService.upsertTaskFromIngest(
        'snapshot-update-item',
        'new-snapshot-item-id',
        1,
        null,
        null
      );

      expect(prismaMock.verificationTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            latestSnapshotItemId: 'new-snapshot-item-id',
          }),
          update: expect.objectContaining({
            latestSnapshotItemId: 'new-snapshot-item-id',
          }),
        })
      );
    });
  });
});
