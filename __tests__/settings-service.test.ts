import { prismaMock } from './utils/prisma-mock';
import { createMockSettings } from './utils/factories';
import { SettingsService } from '../src/lib/settings/service';

describe('SettingsService', () => {
  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const mockSettings = createMockSettings();
      prismaMock.settings.findFirst.mockResolvedValue(mockSettings);

      const result = await SettingsService.getSettings();

      expect(result).toEqual(mockSettings);
      expect(prismaMock.settings.findFirst).toHaveBeenCalled();
      expect(prismaMock.settings.create).not.toHaveBeenCalled();
    });

    it('should create default settings if none exist', async () => {
      const defaultSettings = createMockSettings({
        categories: ['100227'],
        rankingTypes: ['realtime'],
        topN: 30,
      });

      prismaMock.settings.findFirst.mockResolvedValue(null);
      prismaMock.settings.create.mockResolvedValue(defaultSettings);

      const result = await SettingsService.getSettings();

      expect(prismaMock.settings.create).toHaveBeenCalledWith({
        data: {
          categories: ['100227'],
          rankingTypes: ['realtime'],
          topN: 30,
        },
      });
      expect(result).toEqual(defaultSettings);
    });
  });

  describe('updateSettings', () => {
    it('should update settings with new values', async () => {
      const existingSettings = createMockSettings();
      const updatedSettings = createMockSettings({
        topN: 50,
        categories: ['100227', '200162'],
      });

      prismaMock.settings.findFirst.mockResolvedValue(existingSettings);
      prismaMock.settings.update.mockResolvedValue(updatedSettings);

      const result = await SettingsService.updateSettings({
        topN: 50,
        categories: ['100227', '200162'],
      });

      expect(prismaMock.settings.update).toHaveBeenCalledWith({
        where: { id: existingSettings.id },
        data: {
          topN: 50,
          categories: ['100227', '200162'],
        },
      });
      expect(result).toEqual(updatedSettings);
    });

    it('should update only specified fields', async () => {
      const existingSettings = createMockSettings();
      const updatedSettings = createMockSettings({ ingestEnabled: false });

      prismaMock.settings.findFirst.mockResolvedValue(existingSettings);
      prismaMock.settings.update.mockResolvedValue(updatedSettings);

      await SettingsService.updateSettings({ ingestEnabled: false });

      expect(prismaMock.settings.update).toHaveBeenCalledWith({
        where: { id: existingSettings.id },
        data: { ingestEnabled: false },
      });
    });

    it('should update rakutenAppId', async () => {
      const existingSettings = createMockSettings();
      const updatedSettings = createMockSettings({ rakutenAppId: 'new-app-id' });

      prismaMock.settings.findFirst.mockResolvedValue(existingSettings);
      prismaMock.settings.update.mockResolvedValue(updatedSettings);

      await SettingsService.updateSettings({ rakutenAppId: 'new-app-id' });

      expect(prismaMock.settings.update).toHaveBeenCalledWith({
        where: { id: existingSettings.id },
        data: { rakutenAppId: 'new-app-id' },
      });
    });

    it('should handle updating rankingTypes', async () => {
      const existingSettings = createMockSettings();
      const updatedSettings = createMockSettings({
        rankingTypes: ['realtime', 'daily'],
      });

      prismaMock.settings.findFirst.mockResolvedValue(existingSettings);
      prismaMock.settings.update.mockResolvedValue(updatedSettings);

      await SettingsService.updateSettings({
        rankingTypes: ['realtime', 'daily'],
      });

      expect(prismaMock.settings.update).toHaveBeenCalledWith({
        where: { id: existingSettings.id },
        data: { rankingTypes: ['realtime', 'daily'] },
      });
    });
  });
});
