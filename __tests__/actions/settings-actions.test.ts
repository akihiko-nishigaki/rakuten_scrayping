import { prismaMock } from '../utils/prisma-mock';
import { createMockSettings } from '../utils/factories';
import {
    getSettingsAction,
    updateSettingsAction,
    addCategoryAction,
    removeCategoryAction,
    getCategoriesWithStatsAction,
} from '../../src/app/actions/settings';

// Mock revalidatePath
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

describe('Settings Actions', () => {
    describe('getSettingsAction', () => {
        it('should return settings', async () => {
            const mockSettings = createMockSettings();
            prismaMock.settings.findFirst.mockResolvedValue(mockSettings);

            const result = await getSettingsAction();

            expect(result).toEqual(mockSettings);
        });

        it('should create default settings if none exist', async () => {
            const defaultSettings = createMockSettings();
            prismaMock.settings.findFirst.mockResolvedValue(null);
            prismaMock.settings.create.mockResolvedValue(defaultSettings);

            const result = await getSettingsAction();

            expect(result).toEqual(defaultSettings);
            expect(prismaMock.settings.create).toHaveBeenCalled();
        });
    });

    describe('updateSettingsAction', () => {
        it('should update settings and create audit log', async () => {
            const currentSettings = createMockSettings({ topN: 30 });
            const updatedSettings = createMockSettings({ topN: 50 });

            prismaMock.settings.findFirst.mockResolvedValue(currentSettings);
            prismaMock.settings.update.mockResolvedValue(updatedSettings);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            const result = await updateSettingsAction({ topN: 50 });

            expect(result.topN).toBe(50);
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        it('should update multiple fields', async () => {
            const currentSettings = createMockSettings();
            const updatedSettings = createMockSettings({
                categories: ['100227', '200162'],
                topN: 40,
                ingestEnabled: false,
            });

            prismaMock.settings.findFirst.mockResolvedValue(currentSettings);
            prismaMock.settings.update.mockResolvedValue(updatedSettings);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            const result = await updateSettingsAction({
                categories: ['100227', '200162'],
                topN: 40,
                ingestEnabled: false,
            });

            expect(result.categories).toEqual(['100227', '200162']);
            expect(result.topN).toBe(40);
            expect(result.ingestEnabled).toBe(false);
        });
    });

    describe('addCategoryAction', () => {
        it('should add new category', async () => {
            const currentSettings = createMockSettings({ categories: ['100227'] });
            const updatedSettings = createMockSettings({ categories: ['100227', '200162'] });

            prismaMock.settings.findFirst.mockResolvedValue(currentSettings);
            prismaMock.settings.update.mockResolvedValue(updatedSettings);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            const result = await addCategoryAction('200162');

            expect(result.categories).toContain('200162');
        });

        it('should throw error if category already exists', async () => {
            const currentSettings = createMockSettings({ categories: ['100227'] });
            prismaMock.settings.findFirst.mockResolvedValue(currentSettings);

            await expect(addCategoryAction('100227')).rejects.toThrow('Category already exists');
        });
    });

    describe('removeCategoryAction', () => {
        it('should remove category', async () => {
            const currentSettings = createMockSettings({ categories: ['100227', '200162'] });
            const updatedSettings = createMockSettings({ categories: ['200162'] });

            prismaMock.settings.findFirst.mockResolvedValue(currentSettings);
            prismaMock.settings.update.mockResolvedValue(updatedSettings);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            const result = await removeCategoryAction('100227');

            expect(result.categories).not.toContain('100227');
        });
    });

    describe('getCategoriesWithStatsAction', () => {
        it('should return categories with snapshot stats', async () => {
            const mockSettings = createMockSettings({ categories: ['100227', '200162'] });
            prismaMock.settings.findFirst.mockResolvedValue(mockSettings);

            prismaMock.rankingSnapshot.groupBy.mockResolvedValue([
                { categoryId: '100227', _count: { id: 10 }, _max: { capturedAt: new Date() } },
                { categoryId: '200162', _count: { id: 5 }, _max: { capturedAt: new Date() } },
            ] as any);

            const result = await getCategoriesWithStatsAction();

            expect(result).toHaveLength(2);
            expect(result[0].snapshotCount).toBe(10);
            expect(result[1].snapshotCount).toBe(5);
        });

        it('should return 0 count for categories without snapshots', async () => {
            const mockSettings = createMockSettings({ categories: ['100227'] });
            prismaMock.settings.findFirst.mockResolvedValue(mockSettings);
            prismaMock.rankingSnapshot.groupBy.mockResolvedValue([]);

            const result = await getCategoriesWithStatsAction();

            expect(result[0].snapshotCount).toBe(0);
            expect(result[0].lastCaptured).toBeNull();
        });
    });
});
