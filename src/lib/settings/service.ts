import { prisma } from '@/lib/prisma';

export const SettingsService = {
    async getSettings() {
        // Singleton pattern for settings
        const settings = await prisma.settings.findFirst();
        if (!settings) {
            // Create default if not exists
            return await prisma.settings.create({
                data: {
                    categories: ["100227"], // Example: Food
                    rankingTypes: ["realtime"],
                    topN: 30,
                }
            });
        }
        return settings;
    },

    async updateSettings(data: {
        rakutenAppId?: string;
        categories?: string[];
        rankingTypes?: string[];
        topN?: number;
        ingestEnabled?: boolean;
    }) {
        const current = await this.getSettings();
        return await prisma.settings.update({
            where: { id: current.id },
            data,
        });
    }
};
