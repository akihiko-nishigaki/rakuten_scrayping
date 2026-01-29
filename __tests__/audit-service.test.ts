import { prismaMock } from './utils/prisma-mock';
import { createMockAuditLog } from './utils/factories';
import { AuditService } from '../src/lib/audit/service';

describe('AuditService', () => {
  describe('log', () => {
    it('should create audit log with all parameters', async () => {
      const mockLog = createMockAuditLog();
      prismaMock.auditLog.create.mockResolvedValue(mockLog);

      await AuditService.log(
        'VERIFY_RATE',
        'user-1',
        'VerifiedRate',
        'verified-1',
        { previousRate: 3.0, newRate: 5.0 }
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          actionType: 'VERIFY_RATE',
          actorId: 'user-1',
          entityType: 'VerifiedRate',
          entityId: 'verified-1',
          metaJson: { previousRate: 3.0, newRate: 5.0 },
        },
      });
    });

    it('should create audit log with minimal parameters', async () => {
      const mockLog = createMockAuditLog({
        actorId: null,
        entityType: null,
        entityId: null,
        metaJson: null,
      });
      prismaMock.auditLog.create.mockResolvedValue(mockLog);

      await AuditService.log('LOGIN');

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          actionType: 'LOGIN',
          actorId: null,
          entityType: undefined,
          entityId: undefined,
          metaJson: undefined,
        },
      });
    });

    it('should handle null actorId', async () => {
      const mockLog = createMockAuditLog({ actorId: null });
      prismaMock.auditLog.create.mockResolvedValue(mockLog);

      await AuditService.log('INGEST_JOB', null, 'RankingSnapshot', 'snapshot-1');

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: 'INGEST_JOB',
          actorId: null,
        }),
      });
    });

    it('should sanitize meta object to valid JSON', async () => {
      const mockLog = createMockAuditLog();
      prismaMock.auditLog.create.mockResolvedValue(mockLog);

      const metaWithDate = {
        timestamp: new Date('2024-01-01'),
        value: 123,
      };

      await AuditService.log('UPDATE_SETTINGS', 'user-1', 'Settings', 'settings-1', metaWithDate);

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metaJson: expect.any(Object),
        }),
      });
    });

    it('should not throw when audit log creation fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      prismaMock.auditLog.create.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(AuditService.log('LOGIN')).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write audit log:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should log different action types', async () => {
      const actionTypes = ['LOGIN', 'UPDATE_SETTINGS', 'VERIFY_RATE', 'INGEST_JOB'];

      for (const actionType of actionTypes) {
        const mockLog = createMockAuditLog({ actionType });
        prismaMock.auditLog.create.mockResolvedValue(mockLog);

        await AuditService.log(actionType);

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ actionType }),
        });
      }
    });
  });
});
